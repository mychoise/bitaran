import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';

// ---------- businesses ----------

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    panNumber: text('pan_number').notNull().unique(),
    registrationNumber: text('registration_number'),
    phone: text('phone').notNull(),
    email: text('email'),
    address: text('address').notNull(),
    city: text('city'),
    logoKey: text('logo_key'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  // Nepal PAN: exactly 9 digits.
  (t) => [
    check('businesses_pan_number_format', sql`${t.panNumber} ~ '^[0-9]{9}$'`),
  ],
);

// ---------- users ----------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    role: userRoleEnum('role').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_users_business_role').on(t.businessId, t.role),
    // At most one owner per business.
    uniqueIndex('idx_users_one_owner_per_business')
      .on(t.businessId)
      .where(sql`${t.role} = 'owner'`),
  ],
);

// ---------- product_categories ----------

export const productCategories = pgTable(
  'product_categories',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('idx_product_categories_business_name').on(
      t.businessId,
      t.name,
    ),
  ],
);
