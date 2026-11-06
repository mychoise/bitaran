import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orderPaymentEnum, orderStatusEnum } from './enums.js';
import { businesses, users } from './core.js';
import { products } from './products.js';
import { retailClients } from './routing.js';
import { payments, sales } from './selling.js';

// ---------- orders ----------

/**
 * An order an owner or manager takes for a shop (by phone, say). A salesman
 * delivers it from his van: that sale is linked here and the order is then
 * delivered. The money is either taken by the office when the order is
 * placed (prepaid, with that payment linked) or by the salesman on delivery.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => retailClients.id),
    /** The salesman who delivers it. */
    salesmanId: uuid('salesman_id')
      .notNull()
      .references(() => users.id),
    takenBy: uuid('taken_by')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').notNull().default('open'),
    paymentMode: orderPaymentEnum('payment_mode').notNull(),
    prepaidPaymentId: uuid('prepaid_payment_id').references(() => payments.id),
    saleId: uuid('sale_id').references(() => sales.id),
    note: text('note'),
    cancelReason: text('cancel_reason'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_orders_client').on(t.clientId),
    index('idx_orders_salesman_status').on(t.salesmanId, t.status),
  ],
);

// ---------- order_items ----------

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    /** "base" (pieces) or "carton", as on sales. */
    unit: text('unit').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [
    index('idx_order_items_order').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);
