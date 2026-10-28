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
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  products,
  retailClients,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  users,
} from '../database/schema/index.js';
import { workingPlan } from '../day-plans/working-plan.js';
import { StockService } from '../stock/stock.service.js';
import { toBaseUnits } from '../stock/units.js';
import { CreateReturnDto, ListReturnsQueryDto } from './dto/returns.dto.js';

const fail = {
  notFound: () =>
    new NotFoundException(errorBody('RETURN_NOT_FOUND', 'Return not found')),
  clientNotFound: () =>
    new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found')),
  restockNotAllowed: () =>
    new BadRequestException(
      errorBody(
        'RESTOCK_NOT_ALLOWED',
        'Only goods returned for reason "other" can be restocked; damaged and expired goods never go back on the shelf',
      ),
    ),
  priceNotAllowed: () =>
    new ForbiddenException(
      errorBody(
        'FIELD_NOT_ALLOWED',
        'Only managers and owners can set the return price',
      ),
    ),
  saleNotFound: () =>
    new NotFoundException(errorBody('SALE_NOT_FOUND', 'Sale not found')),
  saleMismatch: () =>
    new UnprocessableEntityException(
      errorBody('SALE_MISMATCH', 'saleId must be a sale to the same shop'),
    ),
  saleCancelled: () =>
    new ConflictException(
      errorBody('SALE_CANCELLED', 'This sale is cancelled'),
    ),
  notInSale: (productId: string, unit: string) =>
    new UnprocessableEntityException(
      errorBody(
        'ITEM_NOT_IN_SALE',
        'That product was not sold in that unit on this sale',
        [{ productId, unit }],
      ),
    ),
  moreThanSold: (
    over: {
      productId: string;
      unit: string;
      requested: number;
      returnable: number;
    }[],
  ) =>
    new ConflictException(
      errorBody(
        'RETURN_EXCEEDS_SOLD',
        'Cannot return more than was sold on this sale, less what was already returned',
        over,
      ),
    ),
  priceAboveSale: (productId: string, salePrice: number) =>
    new UnprocessableEntityException(
      errorBody(
        'PRICE_ABOVE_SALE',
        `A return cannot be priced above what the sale charged (${salePrice} paisa)`,
        [{ productId, salePrice }],
      ),
    ),
  productsNotFound: (ids: string[]) =>
    new NotFoundException(
      errorBody(
        'PRODUCT_NOT_FOUND',
        'One or more products were not found',
        ids.map((productId) => ({ productId })),
      ),
    ),
  noCartonPrice: (productId: string) =>
    new UnprocessableEntityException(
      errorBody(
        'NO_CARTON_PRICE',
        'This product has no carton price; give unitPricePaisa or return pieces',
        [{ productId }],
      ),
    ),
};

const returnColumns = {
  id: saleReturns.id,
  saleId: saleReturns.saleId,
  dayPlanId: saleReturns.dayPlanId,
  returnDate: saleReturns.returnDate,
  totalPaisa: saleReturns.totalPaisa,
  note: saleReturns.note,
  createdAt: saleReturns.createdAt,
  client: { id: retailClients.id, name: retailClients.name },
  receivedBy: { id: users.id, fullName: users.fullName },
};

const key = (l: { productId: string; unit: string }) =>
  `${l.productId}:${l.unit}`;

@Injectable()
export class ReturnsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stock: StockService,
  ) {}

  /**
   * Goods coming back from a shop. Lowers the shop's balance by the return's
   * total (see BalanceService). Only items returned for reason "other" and
   * marked restocked go back into warehouse stock.
   */
  async create(actor: StaffTokenPayload, dto: CreateReturnDto) {
    for (const item of dto.items) {
      if (item.restocked && item.reason !== 'other') {
        throw fail.restockNotAllowed();
      }
      if (item.unitPricePaisa !== undefined && actor.role === 'salesman') {
        throw fail.priceNotAllowed();
      }
    }

    const id = await withTransaction(this.db, async (tx) => {
      // Lock order as elsewhere: plan, shop, sale, then products.
      const plan = await workingPlan(tx, actor, dto.dayPlanId, {
        lock: 'share',
        what: 'a return',
      });

      const [client] = await tx
        .select({ id: retailClients.id })
        .from(retailClients)
        .where(
          and(
            eq(retailClients.id, dto.clientId),
            eq(retailClients.businessId, actor.businessId),
          ),
        )
        .for('update');
      // A deactivated shop can still send goods back.
      if (!client) throw fail.clientNotFound();

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
            eq(products.businessId, actor.businessId),
            inArray(products.id, productIds),
          ),
        );
      const byId = new Map(rows.map((p) => [p.id, p]));
      const missing = productIds.filter((p) => !byId.has(p));
      if (missing.length) throw fail.productsNotFound(missing);

      const salePrices = dto.saleId
        ? await this.checkAgainstSale(tx, actor, dto)
        : null;

      const lines = dto.items.map((item) => {
        const product = byId.get(item.productId)!;
        let unitPricePaisa: number;
        if (salePrices) {
          const salePrice = salePrices.get(key(item))!;
          unitPricePaisa = item.unitPricePaisa ?? salePrice;
          if (unitPricePaisa > salePrice) {
            throw fail.priceAboveSale(item.productId, salePrice);
          }
        } else if (item.unitPricePaisa !== undefined) {
          unitPricePaisa = item.unitPricePaisa;
        } else if (item.unit === 'carton') {
          if (product.cartonPricePaisa === null) {
            throw fail.noCartonPrice(product.id);
          }
          unitPricePaisa = product.cartonPricePaisa;
        } else {
          unitPricePaisa = product.pricePaisa;
        }
        return {
          product,
          item,
          unitPricePaisa,
          lineTotalPaisa: multiplyPaisa(unitPricePaisa, item.quantity),
          // Also checks the carton size exists for a carton line.
          base: toBaseUnits(product, item.unit, item.quantity),
        };
      });

      const now = new Date();
      const returnId = randomUUID();
      await tx.insert(saleReturns).values({
        id: returnId,
        businessId: actor.businessId,
        clientId: dto.clientId,
        saleId: dto.saleId,
        dayPlanId: plan?.id,
        receivedBy: actor.sub,
        returnDate: nepalToday(),
        totalPaisa: sumPaisa(lines.map((l) => l.lineTotalPaisa)),
        note: dto.note,
        createdAt: now,
      });
      await tx.insert(saleReturnItems).values(
        lines.map((l) => ({
          id: randomUUID(),
          saleReturnId: returnId,
          productId: l.product.id,
          productName: l.product.name,
          unit: l.item.unit,
          quantity: l.item.quantity,
          unitPricePaisa: l.unitPricePaisa,
          lineTotalPaisa: l.lineTotalPaisa,
          reason: l.item.reason,
          restocked: l.item.restocked ?? false,
        })),
      );

      // Restocked goods back into the warehouse, in product id order.
      const restock = new Map<string, number>();
      for (const l of lines.filter((x) => x.item.restocked)) {
        restock.set(l.product.id, (restock.get(l.product.id) ?? 0) + l.base);
      }
      for (const productId of [...restock.keys()].sort()) {
        await this.stock.adjust(
          actor.businessId,
          productId,
          restock.get(productId)!,
          tx,
        );
      }
      return returnId;
    });
    return this.get(actor, id);
  }

  /**
   * The sale must be a live sale to this shop, every item must have been on
   * it in that unit, and the quantities may not exceed what was sold less
   * what earlier returns already took back. Returns each line's sale price.
   */
  private async checkAgainstSale(
    tx: Transaction,
    actor: StaffTokenPayload,
    dto: CreateReturnDto,
  ): Promise<Map<string, number>> {
    // Locked so two returns against one sale cannot both pass the check.
    const [sale] = await tx
      .select({ clientId: sales.clientId, status: sales.status })
      .from(sales)
      .where(
        and(eq(sales.id, dto.saleId!), eq(sales.businessId, actor.businessId)),
      )
      .for('update');
    if (!sale) throw fail.saleNotFound();
    if (sale.clientId !== dto.clientId) throw fail.saleMismatch();
    if (sale.status !== 'confirmed') throw fail.saleCancelled();

    const [sold, already] = await Promise.all([
      tx
        .select({
          productId: saleItems.productId,
          unit: saleItems.unit,
          quantity: saleItems.quantity,
          unitPricePaisa: saleItems.unitPricePaisa,
        })
        .from(saleItems)
        .where(eq(saleItems.saleId, dto.saleId!)),
      tx
        .select({
          productId: saleReturnItems.productId,
          unit: saleReturnItems.unit,
          quantity: sum(saleReturnItems.quantity).mapWith(Number),
        })
        .from(saleReturnItems)
        .innerJoin(
          saleReturns,
          eq(saleReturns.id, saleReturnItems.saleReturnId),
        )
        .where(
          and(
            eq(saleReturns.businessId, actor.businessId),
            eq(saleReturns.saleId, dto.saleId!),
          ),
        )
        .groupBy(saleReturnItems.productId, saleReturnItems.unit),
    ]);
    const soldBy = new Map(sold.map((s) => [key(s), s]));
    const returnedBy = new Map(already.map((r) => [key(r), r.quantity]));

    const wanted = new Map<string, number>();
    for (const item of dto.items) {
      if (!soldBy.has(key(item))) {
        throw fail.notInSale(item.productId, item.unit);
      }
      wanted.set(key(item), (wanted.get(key(item)) ?? 0) + item.quantity);
    }
    const over = [...wanted]
      .map(([k, requested]) => {
        const s = soldBy.get(k)!;
        return {
          productId: s.productId,
          unit: s.unit,
          requested,
          returnable: s.quantity - (returnedBy.get(k) ?? 0),
        };
      })
      .filter((o) => o.requested > o.returnable);
    if (over.length) throw fail.moreThanSold(over);

    return new Map(sold.map((s) => [key(s), s.unitPricePaisa]));
  }

  // ---------- reads ----------

  async list(
    actor: StaffTokenPayload,
    query: ListReturnsQueryDto,
    scope: { clientId?: string } = {},
  ) {
    const filters: SQL[] = [eq(saleReturns.businessId, actor.businessId)];
    if (actor.role === 'salesman' && !scope.clientId) {
      filters.push(eq(saleReturns.receivedBy, actor.sub));
    } else if (query.receivedBy) {
      filters.push(eq(saleReturns.receivedBy, query.receivedBy));
    }
    const clientId = scope.clientId ?? query.clientId;
    if (clientId) filters.push(eq(saleReturns.clientId, clientId));
    if (query.saleId) filters.push(eq(saleReturns.saleId, query.saleId));
    if (query.dayPlanId) {
      filters.push(eq(saleReturns.dayPlanId, query.dayPlanId));
    }
    if (query.from) filters.push(gte(saleReturns.returnDate, query.from));
    if (query.to) filters.push(lte(saleReturns.returnDate, query.to));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(returnColumns)
        .from(saleReturns)
        .innerJoin(retailClients, eq(retailClients.id, saleReturns.clientId))
        .innerJoin(users, eq(users.id, saleReturns.receivedBy))
        .where(where)
        .orderBy(desc(saleReturns.returnDate), desc(saleReturns.createdAt))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(saleReturns).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** A shop's returns, to any staff of the business (as with its sales). */
  async forClient(
    actor: StaffTokenPayload,
    clientId: string,
    query: ListReturnsQueryDto,
  ) {
    const [client] = await this.db
      .select({ id: retailClients.id })
      .from(retailClients)
      .where(
        and(
          eq(retailClients.id, clientId),
          eq(retailClients.businessId, actor.businessId),
        ),
      );
    if (!client) throw fail.clientNotFound();
    return this.list(actor, query, { clientId });
  }

  /** A return with its items. Salesmen: ones they took only. */
  async get(actor: StaffTokenPayload, id: string) {
    const own =
      actor.role === 'salesman'
        ? eq(saleReturns.receivedBy, actor.sub)
        : undefined;
    const [ret] = await this.db
      .select(returnColumns)
      .from(saleReturns)
      .innerJoin(retailClients, eq(retailClients.id, saleReturns.clientId))
      .innerJoin(users, eq(users.id, saleReturns.receivedBy))
      .where(
        and(
          eq(saleReturns.id, id),
          eq(saleReturns.businessId, actor.businessId),
          own,
        ),
      );
    if (!ret) throw fail.notFound();
    const items = await this.db
      .select({
        id: saleReturnItems.id,
        productId: saleReturnItems.productId,
        productName: saleReturnItems.productName,
        unit: saleReturnItems.unit,
        quantity: saleReturnItems.quantity,
        unitPricePaisa: saleReturnItems.unitPricePaisa,
        lineTotalPaisa: saleReturnItems.lineTotalPaisa,
        reason: saleReturnItems.reason,
        restocked: saleReturnItems.restocked,
      })
      .from(saleReturnItems)
      .where(eq(saleReturnItems.saleReturnId, id))
      .orderBy(asc(saleReturnItems.productName), asc(saleReturnItems.unit));
    return { ...ret, items };
  }
}
