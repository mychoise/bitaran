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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { businesses } from './core.js';
import { productCategories } from './core.js';

// ---------- products ----------

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    categoryId: uuid('category_id').references(() => productCategories.id),
    name: text('name').notNull(),
    description: text('description'),
    brand: text('brand'),
    sku: text('sku'),
    barcode: text('barcode'),
    imageKey: text('image_key'),
    unit: text('unit').notNull().default('piece'),
    unitsPerCarton: integer('units_per_carton'),
    pricePaisa: bigint('price_paisa', { mode: 'number' }).notNull(),
    cartonPricePaisa: bigint('carton_price_paisa', { mode: 'number' }),
    mrpPaisa: bigint('mrp_paisa', { mode: 'number' }),
    costPricePaisa: bigint('cost_price_paisa', { mode: 'number' }),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    lowStockAlert: integer('low_stock_alert'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_products_business_active').on(t.businessId, t.isActive),
    index('idx_products_category').on(t.categoryId),
    uniqueIndex('idx_products_business_sku').on(t.businessId, t.sku),
    check('products_price_paisa_nonneg', sql`${t.pricePaisa} >= 0`),
    check(
      'products_carton_price_paisa_nonneg',
      sql`${t.cartonPricePaisa} >= 0`,
    ),
    check('products_mrp_paisa_nonneg', sql`${t.mrpPaisa} >= 0`),
    check('products_cost_price_paisa_nonneg', sql`${t.costPricePaisa} >= 0`),
    check('products_stock_quantity_nonneg', sql`${t.stockQuantity} >= 0`),
    check('products_units_per_carton_positive', sql`${t.unitsPerCarton} > 0`),
    check('products_low_stock_alert_nonneg', sql`${t.lowStockAlert} >= 0`),
  ],
);
