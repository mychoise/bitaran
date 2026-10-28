import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  date,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { expenseTypeEnum, lossReasonEnum } from './enums.js';
import { businesses, users } from './core.js';
import { retailClients } from './routing.js';
import { products } from './products.js';
import { dayPlans } from './daily-plan.js';
import { sales } from './selling.js';

// ---------- sale_returns ----------

export const saleReturns = pgTable(
  'sale_returns',
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
    receivedBy: uuid('received_by')
      .notNull()
      .references(() => users.id),
    returnDate: date('return_date').notNull(),
    totalPaisa: bigint('total_paisa', { mode: 'number' }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_sale_returns_client_date').on(t.clientId, t.returnDate),
    index('idx_sale_returns_day_plan').on(t.dayPlanId),
    check('sale_returns_total_paisa_nonneg', sql`${t.totalPaisa} >= 0`),
  ],
);

// ---------- sale_return_items ----------

export const saleReturnItems = pgTable(
  'sale_return_items',
  {
    id: uuid('id').primaryKey(),
    saleReturnId: uuid('sale_return_id')
      .notNull()
      .references(() => saleReturns.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    quantity: integer('quantity').notNull(),
    unitPricePaisa: bigint('unit_price_paisa', { mode: 'number' }).notNull(),
    lineTotalPaisa: bigint('line_total_paisa', { mode: 'number' }).notNull(),
    reason: lossReasonEnum('reason').notNull(),
    restocked: boolean('restocked').notNull().default(false),
  },
  (t) => [
    index('idx_sale_return_items_return').on(t.saleReturnId),
    check('sale_return_items_quantity_positive', sql`${t.quantity} > 0`),
    check(
      'sale_return_items_unit_price_paisa_nonneg',
      sql`${t.unitPricePaisa} >= 0`,
    ),
    check(
      'sale_return_items_line_total_paisa_nonneg',
      sql`${t.lineTotalPaisa} >= 0`,
    ),
  ],
);

// ---------- stock_write_offs ----------

export const stockWriteOffs = pgTable(
  'stock_write_offs',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    unit: text('unit').notNull(),
    quantity: integer('quantity').notNull(),
    reason: lossReasonEnum('reason').notNull(),
    costValuePaisa: bigint('cost_value_paisa', { mode: 'number' }),
    writeOffDate: date('write_off_date').notNull(),
    dayPlanId: uuid('day_plan_id').references(() => dayPlans.id),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_stock_write_offs_business_date').on(
      t.businessId,
      t.writeOffDate,
    ),
    index('idx_stock_write_offs_day_plan').on(t.dayPlanId),
    check('stock_write_offs_quantity_positive', sql`${t.quantity} > 0`),
    check(
      'stock_write_offs_cost_value_paisa_nonneg',
      sql`${t.costValuePaisa} >= 0`,
    ),
  ],
);

// ---------- expenses ----------

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    type: expenseTypeEnum('type').notNull(),
    amountPaisa: bigint('amount_paisa', { mode: 'number' }).notNull(),
    expenseDate: date('expense_date').notNull(),
    userId: uuid('user_id').references(() => users.id),
    dayPlanId: uuid('day_plan_id').references(() => dayPlans.id),
    forMonth: date('for_month'),
    description: text('description'),
    receiptKey: text('receipt_key'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_expenses_business_date').on(t.businessId, t.expenseDate),
    index('idx_expenses_user_date').on(t.userId, t.expenseDate),
    check('expenses_amount_paisa_positive', sql`${t.amountPaisa} > 0`),
  ],
);
