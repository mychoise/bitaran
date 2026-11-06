import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import {
  orderItems,
  orders,
  payments,
  products,
  retailClients,
  sales,
  users,
} from '../database/schema/index.js';
import { toBaseUnits } from '../stock/units.js';
import type { CreateOrderDto, ListOrdersQueryDto } from './dto/order.dto.js';

const fail = {
  notFound: () =>
    new NotFoundException(errorBody('ORDER_NOT_FOUND', 'Order not found')),
  shop: () =>
    new UnprocessableEntityException(
      errorBody(
        'CLIENT_NOT_FOUND',
        'That shop is not one of yours, or is inactive',
      ),
    ),
  salesman: () =>
    new UnprocessableEntityException(
      errorBody(
        'SALESMAN_NOT_FOUND',
        'Choose an active salesman to deliver the order',
      ),
    ),
  product: (productId: string) =>
    new UnprocessableEntityException(
      errorBody('PRODUCT_NOT_FOUND', 'A product is unknown or inactive', [
        { productId },
      ]),
    ),
  duplicate: () =>
    new UnprocessableEntityException(
      errorBody(
        'DUPLICATE_LINE',
        'Each product and unit may appear once on an order',
      ),
    ),
  paymentNeeded: () =>
    new UnprocessableEntityException(
      errorBody(
        'PREPAID_PAYMENT_REQUIRED',
        'A prepaid order needs the payment the office recorded',
      ),
    ),
  paymentNotAllowed: () =>
    new UnprocessableEntityException(
      errorBody(
        'PREPAID_PAYMENT_NOT_ALLOWED',
        'Only a prepaid order carries a payment',
      ),
    ),
  paymentWrong: () =>
    new UnprocessableEntityException(
      errorBody(
        'PREPAID_PAYMENT_INVALID',
        'That payment is not this shop’s, or it bounced',
      ),
    ),
  notOpen: (status: string) =>
    new ConflictException(
      errorBody('ORDER_NOT_OPEN', `This order is already ${status}`),
    ),
};

const taker = alias(users, 'taker');
const orderColumns = {
  id: orders.id,
  status: orders.status,
  paymentMode: orders.paymentMode,
  note: orders.note,
  cancelReason: orders.cancelReason,
  createdAt: orders.createdAt,
  deliveredAt: orders.deliveredAt,
  saleId: orders.saleId,
  invoiceNumber: sales.invoiceNumber,
  prepaidPaymentId: orders.prepaidPaymentId,
  prepaidPaisa: payments.amountPaisa,
  prepaidMethod: payments.method,
  prepaidStatus: payments.status,
  client: { id: retailClients.id, name: retailClients.name },
  salesman: { id: users.id, fullName: users.fullName },
  takenBy: { id: taker.id, fullName: taker.fullName },
};

/**
 * Orders the office takes for a shop and a salesman delivers. Owners and
 * managers place and cancel them; a salesman sees the ones he is to deliver,
 * and delivers one by making a sale with its orderId (see SalesService).
 */
@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(actor: StaffTokenPayload, dto: CreateOrderDto) {
    const businessId = actor.businessId;
    const seen = new Set<string>();
    for (const l of dto.items) {
      const k = `${l.productId}:${l.unit}`;
      if (seen.has(k)) throw fail.duplicate();
      seen.add(k);
    }
    if (dto.paymentMode === 'prepaid' && !dto.prepaidPaymentId) {
      throw fail.paymentNeeded();
    }
    if (dto.paymentMode === 'on_delivery' && dto.prepaidPaymentId) {
      throw fail.paymentNotAllowed();
    }

    const id = randomUUID();
    await withTransaction(this.db, async (tx) => {
      const [shop] = await tx
        .select({ id: retailClients.id })
        .from(retailClients)
        .where(
          and(
            eq(retailClients.id, dto.clientId),
            eq(retailClients.businessId, businessId),
            eq(retailClients.isActive, true),
          ),
        );
      if (!shop) throw fail.shop();

      const [salesman] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, dto.salesmanId),
            eq(users.businessId, businessId),
            eq(users.role, 'salesman'),
            eq(users.isActive, true),
          ),
        );
      if (!salesman) throw fail.salesman();

      const found = await tx
        .select({
          id: products.id,
          name: products.name,
          unitsPerCarton: products.unitsPerCarton,
        })
        .from(products)
        .where(
          and(
            eq(products.businessId, businessId),
            eq(products.isActive, true),
            inArray(
              products.id,
              dto.items.map((l) => l.productId),
            ),
          ),
        );
      const byId = new Map(found.map((p) => [p.id, p]));
      for (const l of dto.items) {
        const p = byId.get(l.productId);
        if (!p) throw fail.product(l.productId);
        toBaseUnits(p, l.unit, l.quantity); // refuses cartons without a size
      }

      if (dto.prepaidPaymentId) {
        const [pay] = await tx
          .select({ status: payments.status })
          .from(payments)
          .where(
            and(
              eq(payments.id, dto.prepaidPaymentId),
              eq(payments.businessId, businessId),
              eq(payments.clientId, dto.clientId),
            ),
          );
        if (!pay || pay.status === 'bounced') throw fail.paymentWrong();
      }

      await tx.insert(orders).values({
        id,
        businessId,
        clientId: dto.clientId,
        salesmanId: dto.salesmanId,
        takenBy: actor.sub,
        paymentMode: dto.paymentMode,
        prepaidPaymentId: dto.prepaidPaymentId,
        note: dto.note || null,
        createdAt: new Date(),
      });
      await tx.insert(orderItems).values(
        dto.items.map((l) => ({
          id: randomUUID(),
          orderId: id,
          productId: l.productId,
          productName: byId.get(l.productId)!.name,
          unit: l.unit,
          quantity: l.quantity,
        })),
      );
    });
    return this.get(actor, id);
  }

  async list(actor: StaffTokenPayload, query: ListOrdersQueryDto) {
    const filters: SQL[] = [eq(orders.businessId, actor.businessId)];
    if (actor.role === 'salesman') {
      filters.push(eq(orders.salesmanId, actor.sub));
    } else if (query.salesmanId) {
      filters.push(eq(orders.salesmanId, query.salesmanId));
    }
    if (query.status) filters.push(eq(orders.status, query.status));
    if (query.clientId) filters.push(eq(orders.clientId, query.clientId));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.select()
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);
    const items = await this.itemsOf(rows.map((r) => r.id));
    return buildPaginatedResult(
      rows.map((r) => ({ ...r, items: items.get(r.id) ?? [] })),
      total,
      query,
    );
  }

  async get(actor: StaffTokenPayload, id: string) {
    const own =
      actor.role === 'salesman' ? eq(orders.salesmanId, actor.sub) : undefined;
    const [row] = await this.select().where(
      and(eq(orders.id, id), eq(orders.businessId, actor.businessId), own),
    );
    if (!row) throw fail.notFound();
    const items = await this.itemsOf([id]);
    return { ...row, items: items.get(id) ?? [] };
  }

  async cancel(actor: StaffTokenPayload, id: string, reason: string) {
    await withTransaction(this.db, async (tx) => {
      const [order] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.businessId, actor.businessId)))
        .for('update');
      if (!order) throw fail.notFound();
      if (order.status !== 'open') throw fail.notOpen(order.status);
      await tx
        .update(orders)
        .set({ status: 'cancelled', cancelReason: reason })
        .where(eq(orders.id, id));
    });
    return this.get(actor, id);
  }

  private select() {
    return this.db
      .select(orderColumns)
      .from(orders)
      .innerJoin(retailClients, eq(retailClients.id, orders.clientId))
      .innerJoin(users, eq(users.id, orders.salesmanId))
      .innerJoin(taker, eq(taker.id, orders.takenBy))
      .leftJoin(sales, eq(sales.id, orders.saleId))
      .leftJoin(payments, eq(payments.id, orders.prepaidPaymentId))
      .$dynamic();
  }

  /** Each order's lines, with the product's unit name and today's selling price. */
  private async itemsOf(ids: string[]) {
    const out = new Map<
      string,
      {
        productId: string;
        productName: string;
        baseUnit: string;
        unit: string;
        quantity: number;
        unitPricePaisa: number;
      }[]
    >();
    if (!ids.length) return out;
    const rows = await this.db
      .select({
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        productName: orderItems.productName,
        baseUnit: products.unit,
        unit: orderItems.unit,
        quantity: orderItems.quantity,
        unitPricePaisa:
          sql<number>`case when ${orderItems.unit} = 'carton' then coalesce(${products.cartonPricePaisa}, 0) else ${products.pricePaisa} end`.mapWith(
            Number,
          ),
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(inArray(orderItems.orderId, ids))
      .orderBy(orderItems.productName);
    for (const { orderId, ...item } of rows) {
      out.set(orderId, [...(out.get(orderId) ?? []), item]);
    }
    return out;
  }
}
