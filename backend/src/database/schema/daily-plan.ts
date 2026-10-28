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
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { dayPlanStatusEnum, visitStatusEnum } from './enums.js';
import { businesses, users } from './core.js';
import { routes, retailClients } from './routing.js';
import { products } from './products.js';

// ---------- day_plans ----------

export const dayPlans = pgTable(
  'day_plans',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    salesmanId: uuid('salesman_id')
      .notNull()
      .references(() => users.id),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id),
    planDate: date('plan_date').notNull(),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    status: dayPlanStatusEnum('status').notNull().default('planned'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    cashHandedOverPaisa: bigint('cash_handed_over_paisa', { mode: 'number' }),
    reconciledBy: uuid('reconciled_by').references(() => users.id),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('idx_day_plans_salesman_route_date').on(
      t.salesmanId,
      t.routeId,
      t.planDate,
    ),
    index('idx_day_plans_salesman_date').on(t.salesmanId, t.planDate),
    check(
      'day_plans_cash_handed_over_paisa_nonneg',
      sql`${t.cashHandedOverPaisa} >= 0`,
    ),
  ],
);

// ---------- day_plan_stock ----------

export const dayPlanStock = pgTable(
  'day_plan_stock',
  {
    id: uuid('id').primaryKey(),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    unit: text('unit').notNull(),
    quantityIssued: integer('quantity_issued').notNull(),
    quantityReturned: integer('quantity_returned'),
    quantityCounted: integer('quantity_counted'),
  },
  (t) => [
    uniqueIndex('idx_day_plan_stock_plan_product_unit').on(
      t.dayPlanId,
      t.productId,
      t.unit,
    ),
    check(
      'day_plan_stock_quantity_issued_nonneg',
      sql`${t.quantityIssued} >= 0`,
    ),
    check(
      'day_plan_stock_quantity_returned_nonneg',
      sql`${t.quantityReturned} >= 0`,
    ),
    check(
      'day_plan_stock_quantity_counted_nonneg',
      sql`${t.quantityCounted} >= 0`,
    ),
  ],
);

// ---------- visits ----------

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey(),
    dayPlanId: uuid('day_plan_id')
      .notNull()
      .references(() => dayPlans.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => retailClients.id),
    sequence: integer('sequence').notNull().default(0),
    status: visitStatusEnum('status').notNull().default('planned'),
    visitedAt: timestamp('visited_at', { withTimezone: true }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('idx_visits_day_plan_client').on(t.dayPlanId, t.clientId),
  ],
);

// ---------- visit_photos ----------

export const visitPhotos = pgTable(
  'visit_photos',
  {
    id: uuid('id').primaryKey(),
    visitId: uuid('visit_id')
      .notNull()
      .references(() => visits.id),
    imageKey: text('image_key').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    note: text('note'),
    exifTakenAt: timestamp('exif_taken_at', { withTimezone: true }),
    imageHash: text('image_hash').notNull().unique(),
    distanceFromShopM: integer('distance_from_shop_m'),
    flagReason: text('flag_reason'),
  },
  (t) => [index('idx_visit_photos_visit').on(t.visitId)],
);
