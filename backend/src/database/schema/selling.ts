import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  saleStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  paymentImageKindEnum,
} from './enums.js';
import { businesses, users } from './core.js';
import { retailClients } from './routing.js';
import { products } from './products.js';
import { dayPlans, visits } from './daily-plan.js';

// ---------- invoice_counters ----------

export const invoiceCounters = pgTable(
  'invoice_counters',
  {
    businessId: uuid('business_id')
      .primaryKey()
      .references(() => businesses.id),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (t) => [
    check('invoice_counters_last_number_nonneg', sql`${t.lastNumber} >= 0`),
  ],
);

// ---------- sales ----------

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => retailClients.id),
    salesmanId: uuid('salesman_id')
      .notNull()
      .references(() => users.id),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id),
    visitId: uuid('visit_id').references(() => visits.id),
    invoiceNumber: integer('invoice_number').notNull(),
    saleDate: date('sale_date').notNull(),
    dueDate: date('due_date'),
    discountPaisa: bigint('discount_paisa', { mode: 'number' })
      .notNull()
      .default(0),
    totalPaisa: bigint('total_paisa', { mode: 'number' }).notNull(),
    status: saleStatusEnum('status').notNull().default('confirmed'),
    cancelReason: text('cancel_reason'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_sales_client_date').on(t.clientId, t.saleDate),
    index('idx_sales_salesman_date').on(t.salesmanId, t.saleDate),
    index('idx_sales_day_plan').on(t.dayPlanId),
    uniqueIndex('idx_sales_business_idempotency').on(
      t.businessId,
      t.idempotencyKey,
    ),
    uniqueIndex('idx_sales_business_invoice').on(t.businessId, t.invoiceNumber),
    check('sales_invoice_number_positive', sql`${t.invoiceNumber} > 0`),
    check('sales_discount_paisa_nonneg', sql`${t.discountPaisa} >= 0`),
    check('sales_total_paisa_nonneg', sql`${t.totalPaisa} >= 0`),
  ],
);

// ---------- sale_items ----------

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    quantity: integer('quantity').notNull(),
    unitPricePaisa: bigint('unit_price_paisa', { mode: 'number' }).notNull(),
    lineTotalPaisa: bigint('line_total_paisa', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('idx_sale_items_sale').on(t.saleId),
    index('idx_sale_items_product').on(t.productId),
    check('sale_items_quantity_positive', sql`${t.quantity} > 0`),
    check('sale_items_unit_price_paisa_nonneg', sql`${t.unitPricePaisa} >= 0`),
    check('sale_items_line_total_paisa_nonneg', sql`${t.lineTotalPaisa} >= 0`),
  ],
);

// ---------- payments ----------

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => retailClients.id),
    saleId: uuid('sale_id').references(() => sales.id),
    dayPlanId: uuid('day_plan_id').references(() => dayPlans.id),
    collectedBy: uuid('collected_by')
      .notNull()
      .references(() => users.id),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').notNull().default('confirmed'),
    amountPaisa: bigint('amount_paisa', { mode: 'number' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    chequeNumber: text('cheque_number'),
    chequeBank: text('cheque_bank'),
    chequeDate: date('cheque_date'),
    referenceNo: text('reference_no'),
    note: text('note'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_payments_client_received').on(t.clientId, t.receivedAt),
    index('idx_payments_day_plan').on(t.dayPlanId),
    uniqueIndex('idx_payments_business_idempotency').on(
      t.businessId,
      t.idempotencyKey,
    ),
    check('payments_amount_paisa_positive', sql`${t.amountPaisa} > 0`),
  ],
);

// ---------- payment_images ----------

export const paymentImages = pgTable(
  'payment_images',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    kind: paymentImageKindEnum('kind').notNull(),
    imageKey: text('image_key').notNull(),
    imageHash: text('image_hash').notNull().unique(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('idx_payment_images_payment').on(t.paymentId)],
);
