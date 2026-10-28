import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import {
  isUniqueViolation,
  PG,
  pgErrorOf,
} from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  dayPlans,
  dayPlanStock,
  products,
  retailClients,
  routeClients,
  routes,
  users,
  visits,
} from '../database/schema/index.js';
import { StockService } from '../stock/stock.service.js';
import { toBaseUnits } from '../stock/units.js';
import type { StockUnit } from '../stock/units.js';
import {
  CreateDayPlanDto,
  ListDayPlansQueryDto,
  StockLineDto,
} from './dto/day-plan.dto.js';

const planColumns = {
  id: dayPlans.id,
  planDate: dayPlans.planDate,
  status: dayPlans.status,
  note: dayPlans.note,
  assignedBy: dayPlans.assignedBy,
  startedAt: dayPlans.startedAt,
  closedAt: dayPlans.closedAt,
  createdAt: dayPlans.createdAt,
  salesman: { id: users.id, fullName: users.fullName },
  route: { id: routes.id, name: routes.name },
};

/** A visit as returned to clients, with the shop it is for. */
export const visitColumns = {
  id: visits.id,
  sequence: visits.sequence,
  status: visits.status,
  visitedAt: visits.visitedAt,
  lat: visits.lat,
  lng: visits.lng,
  note: visits.note,
  client: {
    id: retailClients.id,
    name: retailClients.name,
    ownerName: retailClients.ownerName,
    phone: retailClients.phone,
    address: retailClients.address,
    lat: retailClients.lat,
    lng: retailClients.lng,
  },
};

const fail = {
  notFound: () =>
    new NotFoundException(
      errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
    ),
  pastDate: () =>
    new BadRequestException(
      errorBody(
        'PLAN_DATE_IN_PAST',
        'A day plan cannot be made for a past date',
      ),
    ),
  duplicateLine: (productId: string, unit: string) =>
    new BadRequestException(
      errorBody(
        'DUPLICATE_STOCK_LINE',
        'Each product may appear once per unit; combine the quantities',
        [{ productId, unit }],
      ),
    ),
  invalidSalesman: () =>
    new UnprocessableEntityException(
      errorBody(
        'INVALID_SALESMAN',
        'salesmanId must be an active salesman in this business',
      ),
    ),
  routeNotFound: () =>
    new NotFoundException(errorBody('ROUTE_NOT_FOUND', 'Route not found')),
  routeInactive: () =>
    new ConflictException(
      errorBody('ROUTE_INACTIVE', 'This route is deactivated'),
    ),
  duplicatePlan: () =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_EXISTS',
        'This salesman already has a plan for this route on this date',
      ),
    ),
  productsNotFound: (productIds: string[]) =>
    new NotFoundException(
      errorBody(
        'PRODUCT_NOT_FOUND',
        'One or more products were not found',
        productIds.map((productId) => ({ productId })),
      ),
    ),
  productsInactive: (productIds: string[]) =>
    new ConflictException(
      errorBody(
        'PRODUCT_INACTIVE',
        'Deactivated products cannot be issued',
        productIds.map((productId) => ({ productId })),
      ),
    ),
  insufficientStock: (
    shortages: {
      productId: string;
      name: string;
      requested: number;
      available: number;
    }[],
  ) =>
    new ConflictException(
      errorBody(
        'INSUFFICIENT_STOCK',
        `Not enough stock for: ${shortages
          .map((s) => `${s.name} (need ${s.requested}, have ${s.available})`)
          .join('; ')}`,
        shortages,
      ),
    ),
  notStartable: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_STARTABLE',
        `Only a planned day plan can be started; this one is ${status}`,
      ),
    ),
  notToday: (planDate: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_TODAY',
        `This plan is for ${planDate}; only today's plans can be started`,
      ),
    ),
  anotherInProgress: (other: { id: string; planDate: string }) =>
    new ConflictException(
      errorBody(
        'ANOTHER_PLAN_IN_PROGRESS',
        `You already have a day in progress (plan for ${other.planDate}); finish it first`,
        [{ dayPlanId: other.id, planDate: other.planDate }],
      ),
    ),
  notDeletable: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_DELETABLE',
        `Only a planned day plan can be deleted; this one is ${status}`,
      ),
    ),
};

@Injectable()
export class DayPlansService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stock: StockService,
  ) {}

  async list(actor: StaffTokenPayload, query: ListDayPlansQueryDto) {
    const filters: SQL[] = [visibleTo(actor)];
    if (query.date) filters.push(eq(dayPlans.planDate, query.date));
    if (query.salesmanId && actor.role !== 'salesman') {
      filters.push(eq(dayPlans.salesmanId, query.salesmanId));
    }
    if (query.status) filters.push(eq(dayPlans.status, query.status));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(planColumns)
        .from(dayPlans)
        .innerJoin(users, eq(users.id, dayPlans.salesmanId))
        .innerJoin(routes, eq(routes.id, dayPlans.routeId))
        .where(where)
        .orderBy(desc(dayPlans.planDate), asc(users.fullName), asc(dayPlans.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(dayPlans).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** The salesman's plans for today (Nepal time), in full. */
  async today(actor: StaffTokenPayload) {
    const rows = await this.db
      .select({ id: dayPlans.id })
      .from(dayPlans)
      .innerJoin(routes, eq(routes.id, dayPlans.routeId))
      .where(and(visibleTo(actor), eq(dayPlans.planDate, nepalToday())))
      .orderBy(asc(routes.name), asc(dayPlans.id));
    return Promise.all(rows.map((r) => this.get(actor, r.id)));
  }

  /**
   * planned -> in_progress, by the plan's own salesman, on the plan's date.
   * A salesman has at most one plan in progress at a time.
   */
  async start(actor: StaffTokenPayload, id: string) {
    return withTransaction(this.db, async (tx) => {
      // Serialise this salesman's starts: two different plans started at
      // once would otherwise both see "nothing in progress". NO KEY UPDATE
      // does not block rows that merely reference the user.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, actor.sub))
        .for('no key update');

      const [plan] = await tx
        .select({ status: dayPlans.status, planDate: dayPlans.planDate })
        .from(dayPlans)
        .where(ownPlan(actor, id))
        .for('update');
      // Someone else's plan is reported as missing, as on read.
      if (!plan) throw fail.notFound();
      if (plan.status !== 'planned') throw fail.notStartable(plan.status);
      if (plan.planDate !== nepalToday()) throw fail.notToday(plan.planDate);

      const [running] = await tx
        .select({ id: dayPlans.id, planDate: dayPlans.planDate })
        .from(dayPlans)
        .where(
          and(
            eq(dayPlans.businessId, actor.businessId),
            eq(dayPlans.salesmanId, actor.sub),
            eq(dayPlans.status, 'in_progress'),
          ),
        )
        .limit(1);
      if (running) throw fail.anotherInProgress(running);

      await tx
        .update(dayPlans)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(ownPlan(actor, id));
      return this.get(actor, id, tx);
    });
  }

  /** The plan with its stock lines and visits (in route order). */
  async get(
    actor: StaffTokenPayload,
    id: string,
    executor: Database | Transaction = this.db,
  ) {
    const [plan] = await executor
      .select(planColumns)
      .from(dayPlans)
      .innerJoin(users, eq(users.id, dayPlans.salesmanId))
      .innerJoin(routes, eq(routes.id, dayPlans.routeId))
      .where(and(eq(dayPlans.id, id), visibleTo(actor)));
    if (!plan) throw fail.notFound();

    const [stock, stops] = await Promise.all([
      executor
        .select({
          id: dayPlanStock.id,
          unit: dayPlanStock.unit,
          quantityIssued: dayPlanStock.quantityIssued,
          quantityReturned: dayPlanStock.quantityReturned,
          quantityCounted: dayPlanStock.quantityCounted,
          product: {
            id: products.id,
            name: products.name,
            sku: products.sku,
            unit: products.unit,
            unitsPerCarton: products.unitsPerCarton,
          },
        })
        .from(dayPlanStock)
        .innerJoin(products, eq(products.id, dayPlanStock.productId))
        .where(eq(dayPlanStock.dayPlanId, id))
        .orderBy(asc(products.name), asc(dayPlanStock.unit)),
      executor
        .select(visitColumns)
        .from(visits)
        .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
        .where(eq(visits.dayPlanId, id))
        .orderBy(asc(visits.sequence)),
    ]);
    return { ...plan, stock, visits: stops };
  }

  /**
   * Creates the plan, its stock lines and its visits, and takes the issued
   * stock out of the warehouse, all in one transaction.
   */
  async create(actor: StaffTokenPayload, dto: CreateDayPlanDto) {
    if (dto.planDate < nepalToday()) throw fail.pastDate();
    assertNoDuplicateLines(dto.stock);
    const businessId = actor.businessId;

    return withTransaction(this.db, async (tx) => {
      const [salesman] = await tx
        .select({ role: users.role, isActive: users.isActive })
        .from(users)
        .where(
          and(eq(users.id, dto.salesmanId), eq(users.businessId, businessId)),
        );
      if (salesman?.role !== 'salesman' || !salesman.isActive) {
        throw fail.invalidSalesman();
      }

      const [route] = await tx
        .select({ isActive: routes.isActive })
        .from(routes)
        .where(
          and(eq(routes.id, dto.routeId), eq(routes.businessId, businessId)),
        );
      if (!route) throw fail.routeNotFound();
      if (!route.isActive) throw fail.routeInactive();

      const planId = randomUUID();
      try {
        await tx.insert(dayPlans).values({
          id: planId,
          businessId,
          salesmanId: dto.salesmanId,
          routeId: dto.routeId,
          planDate: dto.planDate,
          assignedBy: actor.sub,
          note: dto.note,
          createdAt: new Date(),
        });
      } catch (err) {
        if (isUniqueViolation(err, 'idx_day_plans_salesman_route_date')) {
          throw fail.duplicatePlan();
        }
        throw err;
      }

      const totals = await this.lockAndTotal(tx, businessId, dto.stock);
      if (dto.stock.length) {
        await tx.insert(dayPlanStock).values(
          dto.stock.map((line) => ({
            id: randomUUID(),
            dayPlanId: planId,
            productId: line.productId,
            unit: line.unit,
            quantityIssued: line.quantity,
          })),
        );
      }
      for (const [productId, base] of totals) {
        await this.stock.adjust(businessId, productId, -base, tx);
      }

      // One visit per active shop, in route order. Deactivated shops stay on
      // the route but are not scheduled.
      const stops = await tx
        .select({ clientId: routeClients.clientId })
        .from(routeClients)
        .innerJoin(retailClients, eq(retailClients.id, routeClients.clientId))
        .where(
          and(
            eq(routeClients.routeId, dto.routeId),
            eq(retailClients.isActive, true),
          ),
        )
        .orderBy(asc(routeClients.sequence));
      if (stops.length) {
        await tx.insert(visits).values(
          stops.map((s, sequence) => ({
            id: randomUUID(),
            dayPlanId: planId,
            clientId: s.clientId,
            sequence,
          })),
        );
      }

      return this.get(actor, planId, tx);
    });
  }

  /**
   * The one hard delete in the system, and only for a plan nobody has started:
   * removes it with its lines and visits, and puts the issued stock back.
   */
  async delete(actor: StaffTokenPayload, id: string): Promise<void> {
    const businessId = actor.businessId;
    try {
      await withTransaction(this.db, async (tx) => {
        // Lock the plan so it cannot be started while it is being deleted.
        const [plan] = await tx
          .select({ status: dayPlans.status })
          .from(dayPlans)
          .where(and(eq(dayPlans.id, id), eq(dayPlans.businessId, businessId)))
          .for('update');
        if (!plan) throw fail.notFound();
        if (plan.status !== 'planned') throw fail.notDeletable(plan.status);

        const lines = await tx
          .select({
            productId: dayPlanStock.productId,
            unit: dayPlanStock.unit,
            quantity: dayPlanStock.quantityIssued,
          })
          .from(dayPlanStock)
          .where(eq(dayPlanStock.dayPlanId, id));
        // Carton lines are converted with the product's current carton size.
        // If units_per_carton changed since issue, the amount restored differs
        // from the amount taken: day_plan_stock has no base-unit column.
        const totals = await this.lockAndTotal(
          tx,
          businessId,
          lines.map((l) => ({ ...l, unit: l.unit as StockUnit })),
          { checkAvailable: false, allowInactive: true },
        );
        for (const [productId, base] of totals) {
          await this.stock.adjust(businessId, productId, base, tx);
        }

        await tx.delete(visits).where(eq(visits.dayPlanId, id));
        await tx.delete(dayPlanStock).where(eq(dayPlanStock.dayPlanId, id));
        await tx
          .delete(dayPlans)
          .where(and(eq(dayPlans.id, id), eq(dayPlans.businessId, businessId)));
      });
    } catch (err) {
      // Something already points at this plan (a sale, a photo, ...).
      if (pgErrorOf(err).code === PG.FOREIGN_KEY_VIOLATION) {
        throw fail.notDeletable('in use');
      }
      throw err;
    }
  }

  /**
   * Locks the lines' products (in id order, so concurrent plans cannot
   * deadlock) and returns base units per product, in that same order. Unless
   * told otherwise, refuses inactive products and reports every shortage at
   * once rather than failing on the first.
   */
  private async lockAndTotal(
    tx: Transaction,
    businessId: string,
    lines: Pick<StockLineDto, 'productId' | 'unit' | 'quantity'>[],
    { checkAvailable = true, allowInactive = false } = {},
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (!lines.length) return totals;

    const ids = [...new Set(lines.map((l) => l.productId))].sort();
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        isActive: products.isActive,
        unitsPerCarton: products.unitsPerCarton,
        stockQuantity: products.stockQuantity,
      })
      .from(products)
      .where(
        and(eq(products.businessId, businessId), inArray(products.id, ids)),
      )
      .orderBy(asc(products.id))
      .for('update');
    const byId = new Map(rows.map((p) => [p.id, p]));

    const missing = ids.filter((pid) => !byId.has(pid));
    if (missing.length) throw fail.productsNotFound(missing);
    const inactive = rows.filter((p) => !p.isActive).map((p) => p.id);
    if (inactive.length && !allowInactive) {
      throw fail.productsInactive(inactive);
    }

    for (const pid of ids) totals.set(pid, 0);
    for (const line of lines) {
      const base = toBaseUnits(
        byId.get(line.productId)!,
        line.unit,
        line.quantity,
      );
      totals.set(line.productId, totals.get(line.productId)! + base);
    }

    if (checkAvailable) {
      const shortages = rows
        .filter((p) => totals.get(p.id)! > p.stockQuantity)
        .map((p) => ({
          productId: p.id,
          name: p.name,
          requested: totals.get(p.id)!,
          available: p.stockQuantity,
        }));
      if (shortages.length) throw fail.insufficientStock(shortages);
    }
    return totals;
  }
}

/** Salesmen see only their own plans; everyone sees only their business. */
export function visibleTo(actor: StaffTokenPayload): SQL {
  const own = eq(dayPlans.businessId, actor.businessId);
  return actor.role === 'salesman'
    ? and(own, eq(dayPlans.salesmanId, actor.sub))!
    : own;
}

/** The plan, only if it belongs to this salesman (and their business). */
export function ownPlan(actor: StaffTokenPayload, planId: string): SQL {
  return and(
    eq(dayPlans.id, planId),
    eq(dayPlans.businessId, actor.businessId),
    eq(dayPlans.salesmanId, actor.sub),
  )!;
}

function assertNoDuplicateLines(lines: StockLineDto[]): void {
  const seen = new Set<string>();
  for (const { productId, unit } of lines) {
    const key = `${productId}:${unit}`;
    if (seen.has(key)) throw fail.duplicateLine(productId, unit);
    seen.add(key);
  }
}
