import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, notInArray, sum } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  dayPlans,
  dayPlanStock,
  payments,
  products,
  retailClients,
  visits,
} from '../database/schema/index.js';
import { StockService } from '../stock/stock.service.js';
import { toBaseUnits } from '../stock/units.js';
import type { StockUnit } from '../stock/units.js';
import { DayPlansService, ownPlan, visibleTo } from './day-plans.service.js';
import { CloseDayPlanDto, ReconcileDayPlanDto } from './dto/closing.dto.js';
import { planStockMovements, shortageOf } from './plan-stock.js';

const fail = {
  notFound: () =>
    new NotFoundException(
      errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
    ),
  notInProgress: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_IN_PROGRESS',
        `Only a day in progress can be closed; this one is ${status}`,
      ),
    ),
  visitsPending: (pending: { visitId: string; clientName: string }[]) =>
    new ConflictException(
      errorBody(
        'VISITS_PENDING',
        `Mark every visit visited or skipped before closing: ${pending
          .map((p) => p.clientName)
          .join(', ')}`,
        pending,
      ),
    ),
  linesMismatch: (
    field: 'returned' | 'counted',
    missing: string[],
    extra: string[],
    duplicate: string[],
  ) =>
    new BadRequestException(
      errorBody(
        'STOCK_LINES_MISMATCH',
        `\`${field}\` needs exactly one entry per stock line on the plan`,
        [{ missing, extra, duplicate }],
      ),
    ),
  alreadyReconciled: () =>
    new ConflictException(
      errorBody('ALREADY_RECONCILED', 'This day plan is already reconciled'),
    ),
  notClosed: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_CLOSED',
        `Only a closed day plan can be reconciled; this one is ${status}`,
      ),
    ),
};

const lineKey = (l: { productId: string; unit: string }) =>
  `${l.productId}:${l.unit}`;

@Injectable()
export class ClosingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stock: StockService,
    private readonly dayPlans: DayPlansService,
  ) {}

  /**
   * The salesman ends his day: what came back on each stock line, and the
   * cash he hands over. Every visit must have been visited or skipped.
   */
  async close(actor: StaffTokenPayload, id: string, dto: CloseDayPlanDto) {
    await withTransaction(this.db, async (tx) => {
      // FOR UPDATE: waits for any sale or payment still being recorded on
      // this plan, and stops new ones once closed.
      const [plan] = await tx
        .select({ status: dayPlans.status })
        .from(dayPlans)
        .where(ownPlan(actor, id))
        .for('update');
      if (!plan) throw fail.notFound();
      if (plan.status !== 'in_progress') throw fail.notInProgress(plan.status);

      const pending = await tx
        .select({ visitId: visits.id, clientName: retailClients.name })
        .from(visits)
        .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
        .where(
          and(
            eq(visits.dayPlanId, id),
            notInArray(visits.status, ['visited', 'skipped']),
          ),
        )
        .orderBy(asc(visits.sequence));
      if (pending.length) throw fail.visitsPending(pending);

      const lines = await this.matchLines(tx, id, dto.returned, 'returned');
      for (const { lineId, entry } of lines) {
        await tx
          .update(dayPlanStock)
          .set({ quantityReturned: entry.quantityReturned })
          .where(eq(dayPlanStock.id, lineId));
      }
      await tx
        .update(dayPlans)
        .set({
          status: 'closed',
          closedAt: new Date(),
          cashHandedOverPaisa: dto.cashHandedOverPaisa,
        })
        .where(ownPlan(actor, id));
    });
    return this.dayPlans.get(actor, id);
  }

  /**
   * A manager checks what came back: the counted quantity on each line is
   * recorded and that stock goes back into the warehouse. Once only.
   */
  async reconcile(
    actor: StaffTokenPayload,
    id: string,
    dto: ReconcileDayPlanDto,
  ) {
    await withTransaction(this.db, async (tx) => {
      const [plan] = await tx
        .select({ status: dayPlans.status, note: dayPlans.note })
        .from(dayPlans)
        .where(
          and(eq(dayPlans.id, id), eq(dayPlans.businessId, actor.businessId)),
        )
        .for('update');
      if (!plan) throw fail.notFound();
      if (plan.status === 'reconciled') throw fail.alreadyReconciled();
      if (plan.status !== 'closed') throw fail.notClosed(plan.status);

      const lines = await this.matchLines(tx, id, dto.counted, 'counted');
      const backToStock = new Map<string, number>();
      for (const { lineId, line, entry } of lines) {
        await tx
          .update(dayPlanStock)
          .set({ quantityCounted: entry.quantityCounted })
          .where(eq(dayPlanStock.id, lineId));
        const base = toBaseUnits(
          { id: line.productId, unitsPerCarton: line.unitsPerCarton },
          line.unit as StockUnit,
          entry.quantityCounted,
        );
        backToStock.set(
          line.productId,
          (backToStock.get(line.productId) ?? 0) + base,
        );
      }
      // In product id order, as at issue, so concurrent writers cannot deadlock.
      for (const productId of [...backToStock.keys()].sort()) {
        const base = backToStock.get(productId)!;
        if (base > 0) {
          await this.stock.adjust(actor.businessId, productId, base, tx);
        }
      }

      await tx
        .update(dayPlans)
        .set({
          status: 'reconciled',
          reconciledBy: actor.sub,
          reconciledAt: new Date(),
          ...(dto.note && {
            note: plan.note
              ? `${plan.note}\n\nReconciliation: ${dto.note}`
              : `Reconciliation: ${dto.note}`,
          }),
        })
        .where(
          and(eq(dayPlans.id, id), eq(dayPlans.businessId, actor.businessId)),
        );
    });
    return this.dayPlans.get(actor, id);
  }

  /**
   * Per product, in base units: issued, sold, returned by the salesman,
   * counted by the manager, written off, and the shortage. Plus the cash
   * he should have against what he handed over.
   */
  async report(actor: StaffTokenPayload, id: string) {
    const [plan] = await this.db
      .select({
        id: dayPlans.id,
        status: dayPlans.status,
        planDate: dayPlans.planDate,
        cashHandedOverPaisa: dayPlans.cashHandedOverPaisa,
        closedAt: dayPlans.closedAt,
        reconciledAt: dayPlans.reconciledAt,
        reconciledBy: dayPlans.reconciledBy,
      })
      .from(dayPlans)
      .where(and(eq(dayPlans.id, id), visibleTo(actor)));
    if (!plan) throw fail.notFound();

    const m = await planStockMovements(this.db, actor.businessId, id);
    // Returns exist once the salesman has closed; counts once reconciled.
    const reconciled = plan.status === 'reconciled';
    const closed = reconciled || plan.status === 'closed';
    const productIds = [
      ...new Set([
        ...m.issued.keys(),
        ...m.sold.keys(),
        ...m.writtenOff.keys(),
      ]),
    ];
    const info = productIds.length
      ? await this.db
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            unit: products.unit,
            unitsPerCarton: products.unitsPerCarton,
          })
          .from(products)
          .where(
            and(
              eq(products.businessId, actor.businessId),
              inArray(products.id, productIds),
            ),
          )
          .orderBy(asc(products.name))
      : [];

    const rows = info.map((p) => {
      const figures = {
        issued: m.issued.get(p.id) ?? 0,
        sold: m.sold.get(p.id) ?? 0,
        returned: closed ? (m.returned.get(p.id) ?? 0) : null,
        counted: reconciled ? (m.counted.get(p.id) ?? 0) : null,
        writtenOff: m.writtenOff.get(p.id) ?? 0,
      };
      return { product: p, ...figures, shortage: shortageOf(figures) };
    });

    // Cash only: cheques and transfers are not handed over in hand.
    const [cash] = await this.db
      .select({ total: sum(payments.amountPaisa).mapWith(Number) })
      .from(payments)
      .where(
        and(
          eq(payments.businessId, actor.businessId),
          eq(payments.dayPlanId, id),
          eq(payments.method, 'cash'),
          eq(payments.status, 'confirmed'),
        ),
      );
    const expected = cash.total ?? 0;
    const handed = plan.cashHandedOverPaisa;

    return {
      ...plan,
      /** All quantities are in each product's base unit. */
      products: rows,
      cash: {
        expectedPaisa: expected,
        handedOverPaisa: handed,
        /** handed over - expected: negative means cash is short. */
        differencePaisa: handed === null ? null : handed - expected,
      },
    };
  }

  /**
   * Pairs each entry with its stock line. Every line needs exactly one entry.
   * An entry may also name a product already on the plan in a unit it was
   * not issued in (loose pieces from an opened carton): that becomes a new
   * line with nothing issued. Products not on the plan are refused.
   */
  private async matchLines<E extends { productId: string; unit: string }>(
    tx: Transaction,
    planId: string,
    entries: E[],
    field: 'returned' | 'counted',
  ) {
    const lines = await tx
      .select({
        id: dayPlanStock.id,
        productId: dayPlanStock.productId,
        unit: dayPlanStock.unit,
        unitsPerCarton: products.unitsPerCarton,
      })
      .from(dayPlanStock)
      .innerJoin(products, eq(products.id, dayPlanStock.productId))
      .where(eq(dayPlanStock.dayPlanId, planId));
    const byKey = new Map(lines.map((l) => [lineKey(l), l]));
    const onPlan = new Map(lines.map((l) => [l.productId, l.unitsPerCarton]));

    const seen = new Set<string>();
    const duplicate: string[] = [];
    const extra: string[] = [];
    const added: E[] = [];
    for (const e of entries) {
      const k = lineKey(e);
      if (seen.has(k)) duplicate.push(k);
      else if (!byKey.has(k)) {
        if (onPlan.has(e.productId)) added.push(e);
        else extra.push(k);
      }
      seen.add(k);
    }
    const missing = [...byKey.keys()].filter((k) => !seen.has(k));
    if (missing.length || extra.length || duplicate.length) {
      throw fail.linesMismatch(field, missing, extra, duplicate);
    }

    for (const e of added) {
      // Convertible, or the entry is refused (e.g. cartons of a product
      // with no carton size).
      toBaseUnits(
        { id: e.productId, unitsPerCarton: onPlan.get(e.productId)! },
        e.unit as StockUnit,
        0,
      );
      const id = randomUUID();
      await tx.insert(dayPlanStock).values({
        id,
        dayPlanId: planId,
        productId: e.productId,
        unit: e.unit,
        quantityIssued: 0,
      });
      byKey.set(lineKey(e), {
        id,
        productId: e.productId,
        unit: e.unit,
        unitsPerCarton: onPlan.get(e.productId)!,
      });
    }
    return entries.map((entry) => {
      const line = byKey.get(lineKey(entry))!;
      return { lineId: line.id, line, entry };
    });
  }
}
