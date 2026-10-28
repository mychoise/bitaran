import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gte, lte, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import { multiplyPaisa } from '../common/utils/money.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { products, stockWriteOffs, users } from '../database/schema/index.js';
import { planStockMovements, vanStockLeft } from '../day-plans/plan-stock.js';
import { workingPlan } from '../day-plans/working-plan.js';
import { StockService } from '../stock/stock.service.js';
import { toBaseUnits } from '../stock/units.js';
import { CreateWriteOffDto, ListWriteOffsQueryDto } from './dto/returns.dto.js';

const fail = {
  notFound: () =>
    new NotFoundException(
      errorBody('WRITE_OFF_NOT_FOUND', 'Write-off not found'),
    ),
  productNotFound: () =>
    new NotFoundException(errorBody('PRODUCT_NOT_FOUND', 'Product not found')),
  notOnPlan: () =>
    new UnprocessableEntityException(
      errorBody(
        'PRODUCT_NOT_ON_PLAN',
        'This product was not issued on that day plan',
      ),
    ),
  vanShort: (requested: number, available: number) =>
    new ConflictException(
      errorBody(
        'INSUFFICIENT_PLAN_STOCK',
        `Only ${available} base units of this product are left on the plan; cannot write off ${requested}`,
        [{ requested, available }],
      ),
    ),
};

const baseColumns = {
  id: stockWriteOffs.id,
  product: { id: products.id, name: products.name, unit: products.unit },
  unit: stockWriteOffs.unit,
  quantity: stockWriteOffs.quantity,
  reason: stockWriteOffs.reason,
  writeOffDate: stockWriteOffs.writeOffDate,
  dayPlanId: stockWriteOffs.dayPlanId,
  note: stockWriteOffs.note,
  createdAt: stockWriteOffs.createdAt,
  recordedBy: { id: users.id, fullName: users.fullName },
};
// Cost is never shown to salesmen (as with the catalog).
const columnsFor = (actor: StaffTokenPayload) =>
  actor.role === 'salesman'
    ? baseColumns
    : { ...baseColumns, costValuePaisa: stockWriteOffs.costValuePaisa };

@Injectable()
export class WriteOffsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stock: StockService,
  ) {}

  /**
   * Records stock lost to damage, expiry or otherwise, valued at cost price.
   * On a day plan, the goods are van stock already taken out of the
   * warehouse at issue, so warehouse stock is left alone (the plan's report
   * accounts for them). Without one, warehouse stock is reduced.
   */
  async create(actor: StaffTokenPayload, dto: CreateWriteOffDto) {
    const id = await withTransaction(this.db, async (tx) => {
      // Locked for update, as sales lock it: the van check below must not
      // race a sale taking the same stock.
      const plan = await workingPlan(tx, actor, dto.dayPlanId, {
        lock: 'update',
        managerStatuses: ['planned', 'in_progress', 'closed'],
        what: 'a write-off',
      });

      const [product] = await tx
        .select({
          id: products.id,
          unitsPerCarton: products.unitsPerCarton,
          costPricePaisa: products.costPricePaisa,
        })
        .from(products)
        .where(
          and(
            eq(products.id, dto.productId),
            eq(products.businessId, actor.businessId),
          ),
        );
      if (!product) throw fail.productNotFound();
      const base = toBaseUnits(product, dto.unit, dto.quantity);

      if (plan) {
        const left = vanStockLeft(
          await planStockMovements(tx, actor.businessId, plan.id),
        );
        if (!left.has(product.id)) throw fail.notOnPlan();
        const available = Math.max(0, left.get(product.id)!);
        if (base > available) throw fail.vanShort(base, available);
      } else {
        await this.stock.adjust(actor.businessId, product.id, -base, tx);
      }

      const writeOffId = randomUUID();
      await tx.insert(stockWriteOffs).values({
        id: writeOffId,
        businessId: actor.businessId,
        productId: product.id,
        unit: dto.unit,
        quantity: dto.quantity,
        reason: dto.reason,
        // Cost at this moment, for the base quantity; none if no cost price.
        costValuePaisa:
          product.costPricePaisa === null
            ? null
            : multiplyPaisa(product.costPricePaisa, base),
        writeOffDate: nepalToday(),
        dayPlanId: plan?.id,
        recordedBy: actor.sub,
        note: dto.note,
        createdAt: new Date(),
      });
      return writeOffId;
    });
    return this.get(actor, id);
  }

  async get(actor: StaffTokenPayload, id: string) {
    const own =
      actor.role === 'salesman'
        ? eq(stockWriteOffs.recordedBy, actor.sub)
        : undefined;
    const [row] = await this.db
      .select(columnsFor(actor))
      .from(stockWriteOffs)
      .innerJoin(products, eq(products.id, stockWriteOffs.productId))
      .innerJoin(users, eq(users.id, stockWriteOffs.recordedBy))
      .where(
        and(
          eq(stockWriteOffs.id, id),
          eq(stockWriteOffs.businessId, actor.businessId),
          own,
        ),
      );
    if (!row) throw fail.notFound();
    return row;
  }

  /** Salesmen see only write-offs they recorded. */
  async list(actor: StaffTokenPayload, query: ListWriteOffsQueryDto) {
    const filters: SQL[] = [eq(stockWriteOffs.businessId, actor.businessId)];
    if (actor.role === 'salesman') {
      filters.push(eq(stockWriteOffs.recordedBy, actor.sub));
    } else if (query.recordedBy) {
      filters.push(eq(stockWriteOffs.recordedBy, query.recordedBy));
    }
    if (query.productId) {
      filters.push(eq(stockWriteOffs.productId, query.productId));
    }
    if (query.dayPlanId) {
      filters.push(eq(stockWriteOffs.dayPlanId, query.dayPlanId));
    }
    if (query.reason) filters.push(eq(stockWriteOffs.reason, query.reason));
    if (query.from) filters.push(gte(stockWriteOffs.writeOffDate, query.from));
    if (query.to) filters.push(lte(stockWriteOffs.writeOffDate, query.to));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(columnsFor(actor))
        .from(stockWriteOffs)
        .innerJoin(products, eq(products.id, stockWriteOffs.productId))
        .innerJoin(users, eq(users.id, stockWriteOffs.recordedBy))
        .where(where)
        .orderBy(
          desc(stockWriteOffs.writeOffDate),
          desc(stockWriteOffs.createdAt),
        )
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(stockWriteOffs).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }
}
