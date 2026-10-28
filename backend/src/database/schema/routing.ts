import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { businesses, users } from './core.js';

// ---------- routes ----------

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('idx_routes_business_name').on(t.businessId, t.name)],
);

// ---------- retail_clients ----------

export const retailClients = pgTable(
  'retail_clients',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    ownerName: text('owner_name'),
    phone: text('phone'),
    address: text('address'),
    panNumber: text('pan_number'),
    panCardImageKey: text('pan_card_image_key'),
    registrationNumber: text('registration_number'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    creditLimitPaisa: bigint('credit_limit_paisa', { mode: 'number' })
      .notNull()
      .default(0),
    openingBalancePaisa: bigint('opening_balance_paisa', { mode: 'number' })
      .notNull()
      .default(0),
    linkedBusinessId: uuid('linked_business_id').references(
      () => businesses.id,
    ),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_retail_clients_business').on(t.businessId),
    uniqueIndex('idx_retail_clients_business_pan').on(
      t.businessId,
      t.panNumber,
    ),
    check(
      'retail_clients_pan_number_format',
      sql`${t.panNumber} ~ '^[0-9]{9}$'`,
    ),
    check(
      'retail_clients_credit_limit_paisa_nonneg',
      sql`${t.creditLimitPaisa} >= 0`,
    ),
  ],
);

// ---------- route_clients ----------

export const routeClients = pgTable(
  'route_clients',
  {
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => retailClients.id),
    sequence: integer('sequence').notNull().default(0),
  },
  (t) => [uniqueIndex('route_clients_pkey').on(t.routeId, t.clientId)],
);
