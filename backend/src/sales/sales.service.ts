import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  SQL,
  sql,
  sum,
} from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import { multiplyPaisa, sumPaisa } from '../common/utils/money.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  dayPlans,
  invoiceCounters,
  payments,
  products,
  retailClients,
  saleItems,
  saleReturns,
  sales,
  users,
  visits,
} from '../database/schema/index.js';
import { visibleTo } from '../day-plans/day-plans.service.js';
import { planStockMovements, vanStockLeft } from '../day-plans/plan-stock.js';
import { toBaseUnits } from '../stock/units.js';
import { BalanceService } from '../ledger/balance.service.js';
import {
  CreateSaleDto,
  ListSalesQueryDto,
  SaleItemDto,
} from './dto/sale.dto.js';

const fail = {
  notFound: () =>
    new NotFoundException(errorBody('SALE_NOT_FOUND', 'Sale not found')),
  planNotFound: () =>
    new NotFoundException(
      errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
    ),
  noDayRunning: () =>
    new ConflictException(
      errorBody('NO_DAY_IN_PROGRESS', 'Start your day before making a sale'),
    ),
  planRequired: () =>
    new BadRequestException(
      errorBody(
        'DAY_PLAN_REQUIRED',
        'Give dayPlanId (or visitId) to say which plan’s stock is sold',
      ),
    ),
  planNotInProgress: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_IN_PROGRESS',
        `Sales can only be made on a day in progress; this plan is ${status}`,
      ),
    ),
  visitMismatch: () =>
    new UnprocessableEntityException(
      errorBody(
        'VISIT_MISMATCH',
        'visitId must be a visit to this shop on the same day plan',
      ),
    ),
  clientNotFound: () =>
    new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found')),
  clientInactive: () =>
    new ConflictException(
      errorBody('CLIENT_INACTIVE', 'This shop is deactivated'),
    ),
  duplicateLine: (productId: string, unit: string) =>
    new BadRequestException(
      errorBody(
        'DUPLICATE_SALE_LINE',
        'Each product may appear once per unit; combine the quantities',
        [{ productId, unit }],
      ),
    ),
  dueBeforeSale: () =>
    new BadRequestException(
      errorBody('DUE_DATE_IN_PAST', 'dueDate cannot be before the sale date'),
    ),
  productsNotFound: (productIds: string[]) =>
    new NotFoundException(
      errorBody(
        'PRODUCT_NOT_FOUND',
        'One or more products were not found',
        productIds.map((productId) => ({ productId })),
      ),
    ),
  noCartonPrice: (productId: string) =>
    new UnprocessableEntityException(
      errorBody(
        'NO_CARTON_PRICE',
        'This product has no carton price, so it cannot be sold by the carton',
        [{ productId }],
      ),
    ),
  insufficientPlanStock: (
    shortages: {
      productId: string;
      name: string;
      requested: number;
      available: number;
    }[],
  ) =>
    new ConflictException(
      errorBody(
        'INSUFFICIENT_PLAN_STOCK',
        `Not enough left on this day plan for: ${shortages
          .map(
            (s) =>
              `${s.name} (need ${s.requested}, ${s.available} left, in base units)`,
          )
          .join('; ')}`,
        shortages,
      ),
    ),
  discountTooBig: (subtotal: number) =>
    new UnprocessableEntityException(
      errorBody(
        'DISCOUNT_EXCEEDS_SUBTOTAL',
        `The discount cannot be more than the subtotal (${subtotal} paisa)`,
      ),
    ),
  cashTooBig: (total: number) =>
    new UnprocessableEntityException(
      errorBody(
        'CASH_EXCEEDS_TOTAL',
        `Cash paid now cannot be more than the sale total (${total} paisa); record extra as a separate payment`,
      ),
    ),
  creditLimit: (d: {
    balanceBefore: number;
    balanceAfter: number;
    creditLimit: number;
  }) =>
    new ConflictException(
      errorBody(
        'CREDIT_LIMIT_EXCEEDED',
        `This sale would take the shop’s balance to ${d.balanceAfter} paisa, over its credit limit of ${d.creditLimit}. Take more cash now or ask a manager.`,
        [d],
      ),
    ),
  idempotencyConflict: () =>
    new ConflictException(
      errorBody(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different sale',
      ),
    ),
  alreadyCancelled: () =>
    new ConflictException(
      errorBody('SALE_ALREADY_CANCELLED', 'This sale is already cancelled'),
    ),
  cannotCancel: (why: string) =>
    new ForbiddenException(errorBody('SALE_NOT_CANCELLABLE', why)),
  hasPayment: () =>
    new ConflictException(
      errorBody(
        'SALE_HAS_PAYMENT',
        'This sale has a confirmed payment, so it cannot be cancelled. Record a return instead.',
      ),
    ),
  hasReturn: () =>
    new ConflictException(
      errorBody(
        'SALE_HAS_RETURN',
        'Goods from this sale were already returned, so it cannot be cancelled',
      ),
    ),
  counterMissing: () =>
    new Error('Invoice counter missing for business; create one with it'),
};

const saleColumns = {
  id: sales.id,
  invoiceNumber: sales.invoiceNumber,
  saleDate: sales.saleDate,
  dueDate: sales.dueDate,
  status: sales.status,
  cancelReason: sales.cancelReason,
  discountPaisa: sales.discountPaisa,
  totalPaisa: sales.totalPaisa,
  dayPlanId: sales.dayPlanId,
  visitId: sales.visitId,
  createdAt: sales.createdAt,
  client: { id: retailClients.id, name: retailClients.name },
  salesman: { id: users.id, fullName: users.fullName },
};

export interface CreateSaleResult {
  sale: Awaited<ReturnType<SalesService['get']>>;
  /** True when an earlier request with the same Idempotency-Key is returned. */
  replayed: boolean;
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly balances: BalanceService,
  ) {}

  // ---------- reads ----------

  async list(
    actor: StaffTokenPayload,
    query: ListSalesQueryDto,
    scope: { clientId?: string } = {},
  ) {
    const filters: SQL[] = [eq(sales.businessId, actor.businessId)];
    if (actor.role === 'salesman' && !scope.clientId) {
      filters.push(eq(sales.salesmanId, actor.sub));
    } else if (query.salesmanId) {
      filters.push(eq(sales.salesmanId, query.salesmanId));
    }
    const clientId = scope.clientId ?? query.clientId;
    if (clientId) filters.push(eq(sales.clientId, clientId));
    if (query.dayPlanId) filters.push(eq(sales.dayPlanId, query.dayPlanId));
    if (query.status) filters.push(eq(sales.status, query.status));
    if (query.from) filters.push(gte(sales.saleDate, query.from));
    if (query.to) filters.push(lte(sales.saleDate, query.to));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(saleColumns)
        .from(sales)
        .innerJoin(retailClients, eq(retailClients.id, sales.clientId))
        .innerJoin(users, eq(users.id, sales.salesmanId))
        .where(where)
        .orderBy(desc(sales.invoiceNumber))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(sales).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** A sale with its items and linked payments. Salesmen: their own only. */
  async get(
    actor: StaffTokenPayload,
    id: string,
    executor: Database | Transaction = this.db,
  ) {
    const own =
      actor.role === 'salesman' ? eq(sales.salesmanId, actor.sub) : undefined;
    const [sale] = await executor
      .select(saleColumns)
      .from(sales)
      .innerJoin(retailClients, eq(retailClients.id, sales.clientId))
      .innerJoin(users, eq(users.id, sales.salesmanId))
      .where(
        and(eq(sales.id, id), eq(sales.businessId, actor.businessId), own),
      );
    if (!sale) throw fail.notFound();

    const [items, linked] = await Promise.all([
      executor
        .select({
          id: saleItems.id,
          productId: saleItems.productId,
          productName: saleItems.productName,
          unit: saleItems.unit,
          quantity: saleItems.quantity,
          unitPricePaisa: saleItems.unitPricePaisa,
          lineTotalPaisa: saleItems.lineTotalPaisa,
        })
        .from(saleItems)
        .where(eq(saleItems.saleId, id))
        .orderBy(asc(saleItems.productName), asc(saleItems.unit)),
      executor
        .select({
          id: payments.id,
          method: payments.method,
          status: payments.status,
          amountPaisa: payments.amountPaisa,
          receivedAt: payments.receivedAt,
        })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, actor.businessId),
            eq(payments.saleId, id),
          ),
        )
        .orderBy(asc(payments.receivedAt)),
    ]);
    return {
      ...sale,
      subtotalPaisa: sale.totalPaisa + sale.discountPaisa,
      items,
      payments: linked,
    };
  }

  /** Products and quantities a shop has bought to date, confirmed sales only. */
  async itemsTaken(actor: StaffTokenPayload, clientId: string) {
    await this.assertClient(actor.businessId, clientId);
    return this.db
      .select({
        productId: saleItems.productId,
        productName: products.name,
        unit: saleItems.unit,
        quantity: sum(saleItems.quantity).mapWith(Number),
        totalPaisa: sum(saleItems.lineTotalPaisa).mapWith(Number),
        lastSaleDate: sql<string>`max(${sales.saleDate})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(
        and(
          eq(sales.businessId, actor.businessId),
          eq(sales.clientId, clientId),
          eq(sales.status, 'confirmed'),
        ),
      )
      .groupBy(saleItems.productId, products.name, saleItems.unit)
      .orderBy(asc(products.name), asc(saleItems.unit));
  }

  async clientSales(
    actor: StaffTokenPayload,
    clientId: string,
    query: ListSalesQueryDto,
  ) {
    await this.assertClient(actor.businessId, clientId);
    return this.list(actor, query, { clientId });
  }

  /**
   * The salesman's route screen: every visit on the plan in order, with the
   * shop, its current balance, and what it bought on this plan.
   */
  async planShops(actor: StaffTokenPayload, planId: string) {
    const [plan] = await this.db
      .select({ id: dayPlans.id })
      .from(dayPlans)
      .where(and(eq(dayPlans.id, planId), visibleTo(actor)));
    if (!plan) throw fail.planNotFound();

    const [stops, bought] = await Promise.all([
      this.db
        .select({
          visit: {
            id: visits.id,
            sequence: visits.sequence,
            status: visits.status,
            visitedAt: visits.visitedAt,
          },
          shop: {
            id: retailClients.id,
            name: retailClients.name,
            ownerName: retailClients.ownerName,
            phone: retailClients.phone,
            address: retailClients.address,
            lat: retailClients.lat,
            lng: retailClients.lng,
            creditLimitPaisa: retailClients.creditLimitPaisa,
          },
        })
        .from(visits)
        .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
        .where(eq(visits.dayPlanId, planId))
        .orderBy(asc(visits.sequence)),
      this.db
        .select({
          clientId: sales.clientId,
          total: sum(sales.totalPaisa).mapWith(Number),
        })
        .from(sales)
        .where(
          and(
            eq(sales.businessId, actor.businessId),
            eq(sales.dayPlanId, planId),
            eq(sales.status, 'confirmed'),
          ),
        )
        .groupBy(sales.clientId),
    ]);
    const balances = await this.balances.balancesOf(
      actor.businessId,
      stops.map((s) => s.shop.id),
    );
    const boughtBy = new Map(bought.map((b) => [b.clientId, b.total]));
    return stops.map((s) => ({
      ...s,
      balancePaisa: balances.get(s.shop.id) ?? 0,
      purchasedOnPlanPaisa: boughtBy.get(s.shop.id) ?? 0,
    }));
  }

  // ---------- create ----------

  /**
   * Records a sale in one transaction: prices from the database, plan stock
   * checked, totals computed here, optional cash payment, credit check, then
   * the next invoice number. Retrying with the same Idempotency-Key returns
   * the first sale and creates nothing.
   */
  async create(
    actor: StaffTokenPayload,
    dto: CreateSaleDto,
    idempotencyKey: string,
  ): Promise<CreateSaleResult> {
    const replay = await this.findReplay(actor, dto, idempotencyKey);
    if (replay) return replay;

    assertNoDuplicateLines(dto.items);
    const saleDate = nepalToday();
    if (dto.dueDate && dto.dueDate < saleDate) throw fail.dueBeforeSale();

    try {
      const id = await withTransaction(this.db, (tx) =>
        this.createIn(tx, actor, dto, idempotencyKey, saleDate),
      );
      return { sale: await this.get(actor, id), replayed: false };
    } catch (err) {
      // Two requests with one key at the same moment: the loser returns the
      // winner's sale.
      if (isUniqueViolation(err, 'idx_sales_business_idempotency')) {
        const again = await this.findReplay(actor, dto, idempotencyKey);
        if (again) return again;
      }
      throw err;
    }
  }

  private async createIn(
    tx: Transaction,
    actor: StaffTokenPayload,
    dto: CreateSaleDto,
    idempotencyKey: string,
    saleDate: string,
  ): Promise<string> {
    const businessId = actor.businessId;

    // Lock order everywhere: day plan, then shop, then invoice counter.
    // The plan lock serialises sales against the same van stock.
    const plan = await this.lockPlan(tx, actor, dto);
    if (plan.status !== 'in_progress') {
      throw fail.planNotInProgress(plan.status);
    }

    if (dto.visitId) {
      const [visit] = await tx
        .select({ clientId: visits.clientId })
        .from(visits)
        .where(and(eq(visits.id, dto.visitId), eq(visits.dayPlanId, plan.id)));
      if (visit?.clientId !== dto.clientId) throw fail.visitMismatch();
    }

    // The shop lock serialises credit checks for the same shop.
    const [client] = await tx
      .select({
        isActive: retailClients.isActive,
        creditLimitPaisa: retailClients.creditLimitPaisa,
      })
      .from(retailClients)
      .where(
        and(
          eq(retailClients.id, dto.clientId),
          eq(retailClients.businessId, businessId),
        ),
      )
      .for('update');
    if (!client) throw fail.clientNotFound();
    if (!client.isActive) throw fail.clientInactive();

    // Prices, names and carton sizes come only from the database.
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        pricePaisa: products.pricePaisa,
        cartonPricePaisa: products.cartonPricePaisa,
        unitsPerCarton: products.unitsPerCarton,
      })
      .from(products)
      .where(
        and(
          eq(products.businessId, businessId),
          inArray(products.id, productIds),
        ),
      );
    const byId = new Map(rows.map((p) => [p.id, p]));

    const missing = productIds.filter((pid) => !byId.has(pid));
    if (missing.length) throw fail.productsNotFound(missing);

    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId)!;
      let unitPricePaisa = product.pricePaisa;
      if (item.unit === 'carton') {
        if (product.cartonPricePaisa === null) {
          throw fail.noCartonPrice(product.id);
        }
        unitPricePaisa = product.cartonPricePaisa;
      }
      return {
        product,
        unit: item.unit,
        quantity: item.quantity,
        unitPricePaisa,
        lineTotalPaisa: multiplyPaisa(unitPricePaisa, item.quantity),
        base: toBaseUnits(product, item.unit, item.quantity),
      };
    });

    // Enough left on the plan, in base units, for every product at once.
    // Issued, less confirmed sales (cancelled ones free stock) and
    // write-offs.
    const left = vanStockLeft(
      await planStockMovements(tx, businessId, plan.id),
    );
    const wanted = new Map<string, number>();
    for (const l of lines) {
      wanted.set(l.product.id, (wanted.get(l.product.id) ?? 0) + l.base);
    }
    const shortages = [...wanted]
      .filter(([pid, need]) => need > (left.get(pid) ?? 0))
      .map(([pid, need]) => ({
        productId: pid,
        name: byId.get(pid)!.name,
        requested: need,
        available: Math.max(0, left.get(pid) ?? 0),
      }));
    if (shortages.length) throw fail.insufficientPlanStock(shortages);

    const subtotal = sumPaisa(lines.map((l) => l.lineTotalPaisa));
    const discount = dto.discountPaisa ?? 0;
    if (discount > subtotal) throw fail.discountTooBig(subtotal);
    const total = subtotal - discount;
    const cash = dto.cashPaidNowPaisa ?? 0;
    if (cash > total) throw fail.cashTooBig(total);

    // Credit: the balance after this sale and its cash payment. Only a sale
    // that adds credit (total above cash) can be refused; managers and owners
    // may go over the limit.
    const balanceBefore = await this.balances.balanceOf(
      businessId,
      dto.clientId,
      tx,
    );
    const balanceAfter = balanceBefore + total - cash;
    if (
      actor.role === 'salesman' &&
      total > cash &&
      balanceAfter > client.creditLimitPaisa
    ) {
      throw fail.creditLimit({
        balanceBefore,
        balanceAfter,
        creditLimit: client.creditLimitPaisa,
      });
    }

    // One atomic statement: never read the counter and write it back.
    const [counter] = await tx
      .update(invoiceCounters)
      .set({ lastNumber: sql`${invoiceCounters.lastNumber} + 1` })
      .where(eq(invoiceCounters.businessId, businessId))
      .returning({ lastNumber: invoiceCounters.lastNumber });
    if (!counter) throw fail.counterMissing();

    const saleId = randomUUID();
    const now = new Date();
    await tx.insert(sales).values({
      id: saleId,
      businessId,
      clientId: dto.clientId,
      salesmanId: plan.salesmanId,
      dayPlanId: plan.id,
      visitId: dto.visitId,
      invoiceNumber: counter.lastNumber,
      saleDate,
      dueDate: dto.dueDate,
      discountPaisa: discount,
      totalPaisa: total,
      idempotencyKey,
      createdAt: now,
    });
    await tx.insert(saleItems).values(
      lines.map((l) => ({
        id: randomUUID(),
        saleId,
        productId: l.product.id,
        productName: l.product.name,
        unit: l.unit,
        quantity: l.quantity,
        unitPricePaisa: l.unitPricePaisa,
        lineTotalPaisa: l.lineTotalPaisa,
      })),
    );
    if (cash > 0) {
      await tx.insert(payments).values({
        id: randomUUID(),
        businessId,
        clientId: dto.clientId,
        saleId,
        dayPlanId: plan.id,
        collectedBy: actor.sub,
        method: 'cash',
        status: 'confirmed',
        amountPaisa: cash,
        receivedAt: now,
        createdAt: now,
      });
    }
    return saleId;
  }

  /** The plan whose stock is sold, locked. See CreateSaleDto.dayPlanId. */
  private async lockPlan(
    tx: Transaction,
    actor: StaffTokenPayload,
    dto: CreateSaleDto,
  ) {
    const scope: SQL[] = [eq(dayPlans.businessId, actor.businessId)];
    if (actor.role === 'salesman')
      scope.push(eq(dayPlans.salesmanId, actor.sub));

    if (dto.dayPlanId) {
      scope.push(eq(dayPlans.id, dto.dayPlanId));
    } else if (dto.visitId) {
      scope.push(
        eq(
          dayPlans.id,
          tx
            .select({ id: visits.dayPlanId })
            .from(visits)
            .where(eq(visits.id, dto.visitId)),
        ),
      );
    } else if (actor.role === 'salesman') {
      scope.push(eq(dayPlans.status, 'in_progress'));
    } else {
      throw fail.planRequired();
    }

    const [plan] = await tx
      .select({
        id: dayPlans.id,
        status: dayPlans.status,
        salesmanId: dayPlans.salesmanId,
      })
      .from(dayPlans)
      .where(and(...scope))
      .for('update');
    if (!plan) {
      throw !dto.dayPlanId && !dto.visitId
        ? fail.noDayRunning()
        : dto.visitId && !dto.dayPlanId
          ? fail.visitMismatch()
          : fail.planNotFound();
    }
    return plan;
  }

  /** The earlier sale under this key, if any. A key is never reused. */
  private async findReplay(
    actor: StaffTokenPayload,
    dto: CreateSaleDto,
    idempotencyKey: string,
  ): Promise<CreateSaleResult | null> {
    const [prior] = await this.db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        salesmanId: sales.salesmanId,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, actor.businessId),
          eq(sales.idempotencyKey, idempotencyKey),
        ),
      );
    if (!prior) return null;
    // Keys are per business; a salesman cannot replay (and so read) someone
    // else's sale, and one key cannot stand for two different shops.
    if (
      prior.clientId !== dto.clientId ||
      (actor.role === 'salesman' && prior.salesmanId !== actor.sub)
    ) {
      throw fail.idempotencyConflict();
    }
    return { sale: await this.get(actor, prior.id), replayed: true };
  }

  // ---------- cancel ----------

  /**
   * Cancels a sale: it keeps its invoice number but stops counting towards
   * balances, plan stock and reports. Not allowed once a confirmed payment
   * is linked to it; that needs a return.
   */
  async cancel(actor: StaffTokenPayload, id: string, reason: string) {
    const mine = (table: typeof sales | typeof payments | typeof saleReturns) =>
      eq(table.businessId, actor.businessId);
    await withTransaction(this.db, async (tx) => {
      const [found] = await tx
        .select({ dayPlanId: sales.dayPlanId })
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.businessId, actor.businessId)));
      if (!found) throw fail.notFound();

      // Same lock order as create: plan, then the sale itself.
      const [plan] = await tx
        .select({ status: dayPlans.status })
        .from(dayPlans)
        .where(
          and(
            eq(dayPlans.id, found.dayPlanId),
            eq(dayPlans.businessId, actor.businessId),
          ),
        )
        .for('update');
      const [sale] = await tx
        .select({ status: sales.status, salesmanId: sales.salesmanId })
        .from(sales)
        .where(and(eq(sales.id, id), mine(sales)))
        .for('update');

      if (actor.role === 'salesman') {
        // Someone else's sale is reported as missing, as on read.
        if (sale.salesmanId !== actor.sub) throw fail.notFound();
        if (plan.status !== 'in_progress') {
          throw fail.cannotCancel(
            'You can only cancel your own sales while your day is in progress; ask a manager',
          );
        }
      }
      if (sale.status === 'cancelled') throw fail.alreadyCancelled();

      const [paid] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            mine(payments),
            eq(payments.saleId, id),
            eq(payments.status, 'confirmed'),
          ),
        )
        .limit(1);
      if (paid) throw fail.hasPayment();

      // Its returns already lowered the balance; cancelling as well would
      // credit the shop twice.
      const [returned] = await tx
        .select({ id: saleReturns.id })
        .from(saleReturns)
        .where(and(mine(saleReturns), eq(saleReturns.saleId, id)))
        .limit(1);
      if (returned) throw fail.hasReturn();

      await tx
        .update(sales)
        .set({ status: 'cancelled', cancelReason: reason })
        .where(and(eq(sales.id, id), mine(sales)));
    });
    return this.get(actor, id);
  }

  private async assertClient(businessId: string, clientId: string) {
    const [row] = await this.db
      .select({ id: retailClients.id })
      .from(retailClients)
      .where(
        and(
          eq(retailClients.id, clientId),
          eq(retailClients.businessId, businessId),
        ),
      );
    if (!row) throw fail.clientNotFound();
  }
}

function assertNoDuplicateLines(items: SaleItemDto[]): void {
  const seen = new Set<string>();
  for (const { productId, unit } of items) {
    const key = `${productId}:${unit}`;
    if (seen.has(key)) throw fail.duplicateLine(productId, unit);
    seen.add(key);
  }
}
