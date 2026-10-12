// Wholesale marketplace - Drizzle schema (PostgreSQL)
// Requires drizzle-orm >= 0.36 (array form of the table extra-config callback).
//
// - Many independent sellers, one platform. Any org can buy and/or sell.
// - Online payments only (eSewa, Khalti), paid straight to the seller.
// - Platform handles delivery (logistics only).
// - Platform earns a flat monthly fee per seller (plans / subscriptions).
//
// Money is integer paisa. Unit prices are integer; totals are bigint (mode: 'bigint'),
// so serialise them to strings in API responses.

import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const paisa = (name: string) => bigint(name, { mode: 'bigint' });

// ---------- Enums ----------

export const orgType = pgEnum('org_type', ['PLATFORM', 'BUSINESS']);
export const orgStatus = pgEnum('org_status', [
  'PENDING',
  'APPROVED',
  'SUSPENDED',
]);
export const paymentProvider = pgEnum('payment_provider', ['ESEWA', 'KHALTI']);
export const stockReason = pgEnum('stock_reason', [
  'ORDER_RESERVE',
  'ORDER_RELEASE',
  'ORDER_SHIPPED',
  'RECEIPT',
  'ADJUSTMENT',
]);
export const orderStatus = pgEnum('order_status', [
  'PAYMENT_PENDING',
  'PAYMENT_FAILED',
  'PAID',
  'CONFIRMED',
  'REJECTED_REFUND_PENDING',
  'REFUNDED',
  'READY_FOR_PICKUP',
  'IN_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]);
export const paymentStatus = pgEnum('payment_status', [
  'INITIATED',
  'VERIFIED',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED',
]);
export const shipmentStatus = pgEnum('shipment_status', [
  'PICKUP_PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'RETURNED',
]);
export const subscriptionStatus = pgEnum('subscription_status', [
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
]);
export const fieldSellerStatus = pgEnum('field_seller_status', ['ACTIVE', 'DISABLED']);
export const fieldPaymentMethod = pgEnum('field_payment_method', ['CASH', 'ESEWA', 'KHALTI', 'OTHER']);
export const fieldSaleStatus = pgEnum('field_sale_status', ['ACTIVE', 'VOIDED']);

// ---------- Identity & tenancy ----------

export const users = pgTable(
  'users',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').unique(), // nullable: field sellers sign in with a username
    username: text('username').unique(),
    phone: text('phone').unique(),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: createdAt(),
  },
  (t) => [check('users_login_identifier_chk', sql`${t.email} IS NOT NULL OR ${t.username} IS NOT NULL`)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export const organizations = pgTable('organizations', {
  id: id(),
  type: orgType('type').notNull().default('BUSINESS'),
  name: text('name').notNull(),
  panNumber: text('pan_number'),
  canSell: boolean('can_sell').notNull().default(false),
  canBuy: boolean('can_buy').notNull().default(true),
  status: orgStatus('status').notNull().default('PENDING'),
  documentFileName: text('document_file_name'),
  documentData: text('document_data'),
  documentMimeType: text('document_mime_type'),
  createdAt: createdAt(),
});

export const roles = pgTable('roles', {
  id: id(),
  name: text('name').notNull().unique(), // SUPER_ADMIN, ADMIN, OWNER, STAFF
  permissions: text('permissions')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`), // e.g. order.accept
});

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
  },
  (t) => [
    uniqueIndex('memberships_user_org_uq').on(t.userId, t.orgId),
    index('memberships_org_idx').on(t.orgId),
  ],
);

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    label: text('label'),
    line1: text('line1').notNull(),
    city: text('city').notNull(),
    district: text('district'),
    province: text('province'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
  },
  (t) => [index('addresses_org_idx').on(t.orgId)],
);

// ---------- Seller payment accounts (money goes straight to the seller) ----------

export const gatewayAccounts = pgTable(
  'gateway_accounts',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    provider: paymentProvider('provider').notNull(),
    merchantCode: text('merchant_code'),
    secretEncrypted: text('secret_encrypted').notNull(), // AES-GCM at app level. Never log.
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('gateway_accounts_org_provider_uq').on(t.orgId, t.provider),
  ],
);

// ---------- Catalog & inventory (per seller) ----------

export const categories = pgTable('categories', {
  id: id(),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
});

export const products = pgTable(
  'products',
  {
    id: id(),
    sellerOrgId: uuid('seller_org_id')
      .notNull()
      .references(() => organizations.id),
    categoryId: uuid('category_id').references(() => categories.id),
    masterProductId: uuid('master_product_id'), // reserved for a future global catalog
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('DRAFT'), // DRAFT | ACTIVE | ARCHIVED
    createdAt: createdAt(),
  },
  (t) => [
    index('products_seller_idx').on(t.sellerOrgId),
    index('products_category_idx').on(t.categoryId),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    sku: text('sku').notNull(),
    unit: text('unit').notNull(), // piece, carton, kg ...
    packSize: integer('pack_size').notNull().default(1),
    pricePaisa: integer('price_paisa').notNull(),
    minOrderQty: integer('min_order_qty').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('product_variants_product_sku_uq').on(t.productId, t.sku),
    check('product_variants_price_chk', sql`${t.pricePaisa} >= 0`),
    check('product_variants_moq_chk', sql`${t.minOrderQty} >= 1`),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    url: text('url').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: id(),
    variantId: uuid('variant_id')
      .notNull()
      .unique()
      .references(() => productVariants.id),
    qtyOnHand: integer('qty_on_hand').notNull().default(0),
    qtyReserved: integer('qty_reserved').notNull().default(0),
  },
  (t) => [
    check(
      'inventory_items_qty_chk',
      sql`${t.qtyOnHand} >= 0 AND ${t.qtyReserved} >= 0 AND ${t.qtyReserved} <= ${t.qtyOnHand}`,
    ),
  ],
);

// Append-only
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: id(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    delta: integer('delta').notNull(),
    reason: stockReason('reason').notNull(),
    refId: uuid('ref_id'), // order id etc.
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_variant_idx').on(t.variantId)],
);

// ---------- Cart, checkout, orders ----------

export const carts = pgTable(
  'carts',
  {
    id: id(),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('carts_buyer_idx').on(t.buyerOrgId)],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    qty: integer('qty').notNull(),
  },
  (t) => [
    uniqueIndex('cart_items_cart_variant_uq').on(t.cartId, t.variantId),
    check('cart_items_qty_chk', sql`${t.qty} > 0`),
  ],
);

// One checkout = one buyer action. It splits into one order per seller.
export const checkouts = pgTable(
  'checkouts',
  {
    id: id(),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id),
    shippingAddress: jsonb('shipping_address').notNull(), // snapshot
    totalPaisa: paisa('total_paisa').notNull(),
    paymentProvider: paymentProvider('payment_provider').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('checkouts_buyer_idx').on(t.buyerOrgId)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    checkoutId: uuid('checkout_id')
      .notNull()
      .references(() => checkouts.id),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id),
    sellerOrgId: uuid('seller_org_id')
      .notNull()
      .references(() => organizations.id),
    status: orderStatus('status').notNull().default('PAYMENT_PENDING'),
    subtotalPaisa: paisa('subtotal_paisa').notNull(),
    deliveryFee: integer('delivery_fee').notNull().default(0),
    totalPaisa: paisa('total_paisa').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'orders_buyer_ne_seller_chk',
      sql`${t.buyerOrgId} <> ${t.sellerOrgId}`,
    ),
    index('orders_buyer_idx').on(t.buyerOrgId),
    index('orders_seller_status_idx').on(t.sellerOrgId, t.status),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    nameSnapshot: text('name_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot').notNull(),
    unitPricePaisa: integer('unit_price_paisa').notNull(), // snapshotted, never read from live price
    qty: integer('qty').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_qty_chk', sql`${t.qty} > 0`),
  ],
);

// Append-only
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    actorId: uuid('actor_id'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId)],
);

// ---------- Payments ----------

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    provider: paymentProvider('provider').notNull(),
    status: paymentStatus('status').notNull().default('INITIATED'),
    amountPaisa: paisa('amount_paisa').notNull(),
    gatewayRef: text('gateway_ref'), // transaction id from the gateway
    createdAt: createdAt(),
  },
  (t) => [
    // Idempotency: a gateway transaction can only be recorded once
    uniqueIndex('payments_provider_ref_uq').on(t.provider, t.gatewayRef),
    index('payments_order_idx').on(t.orderId),
  ],
);

// Append-only. Scrub secrets before storing.
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    type: text('type').notNull(), // INITIATE | CALLBACK | VERIFY | REFUND_NOTE
    raw: jsonb('raw').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('payment_events_payment_idx').on(t.paymentId)],
);

// ---------- Delivery (platform logistics) ----------

export const shipments = pgTable('shipments', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id),
  status: shipmentStatus('status').notNull().default('PICKUP_PENDING'),
  pickupAddress: jsonb('pickup_address').notNull(),
  dropAddress: jsonb('drop_address').notNull(),
  courierName: text('courier_name'),
  trackingRef: text('tracking_ref'),
  feePaisa: integer('fee_paisa').notNull().default(0),
  createdAt: createdAt(),
});

// Append-only
export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: id(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id),
    status: shipmentStatus('status').notNull(),
    note: text('note'),
    actorId: uuid('actor_id'),
    createdAt: createdAt(),
  },
  (t) => [index('shipment_events_shipment_idx').on(t.shipmentId)],
);

// ---------- Platform revenue: flat monthly fee per seller ----------

export const plans = pgTable('plans', {
  id: id(),
  name: text('name').notNull(),
  pricePaisa: integer('price_paisa').notNull(),
  maxProducts: integer('max_products'),
});

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  orgId: uuid('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatus('status').notNull().default('ACTIVE'),
  currentPeriodEnd: timestamp('current_period_end', {
    withTimezone: true,
  }).notNull(),
});

export const subscriptionInvoices = pgTable(
  'subscription_invoices',
  {
    id: id(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    amountPaisa: integer('amount_paisa').notNull(),
    status: text('status').notNull().default('UNPAID'), // UNPAID | PAID | VOID
    paidVia: paymentProvider('paid_via'),
    gatewayRef: text('gateway_ref'),
    createdAt: createdAt(),
  },
  (t) => [index('subscription_invoices_sub_idx').on(t.subscriptionId)],
);

// ---------- Audit ----------

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id),
    orgId: uuid('org_id').references(() => organizations.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entity, t.entityId)],
);

// ---------- Relations ----------

import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  refreshTokens: many(refreshTokens),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  addresses: many(addresses),
  products: many(products),
  carts: many(carts),
  checkouts: many(checkouts),
  buyerOrders: many(orders, { relationName: 'buyerOrders' }),
  sellerOrders: many(orders, { relationName: 'sellerOrders' }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  org: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
  role: one(roles, { fields: [memberships.roleId], references: [roles.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  children: many(categories, { relationName: 'categoryParent' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  sellerOrg: one(organizations, {
    fields: [products.sellerOrgId],
    references: [organizations.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    inventoryItem: one(inventoryItems, {
      fields: [productVariants.id],
      references: [inventoryItems.variantId],
    }),
  }),
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryItems.variantId],
    references: [productVariants.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  buyerOrg: one(organizations, {
    fields: [carts.buyerOrgId],
    references: [organizations.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  checkout: one(checkouts, {
    fields: [orders.checkoutId],
    references: [checkouts.id],
  }),
  buyerOrg: one(organizations, {
    fields: [orders.buyerOrgId],
    references: [organizations.id],
    relationName: 'buyerOrders',
  }),
  sellerOrg: one(organizations, {
    fields: [orders.sellerOrgId],
    references: [organizations.id],
    relationName: 'sellerOrders',
  }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  payments: many(payments),
  shipment: one(shipments, {
    fields: [orders.id],
    references: [shipments.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  events: many(paymentEvents),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  events: many(shipmentEvents),
}));

// ---------- Field sellers (moving sellers employed by a seller business) ----------
// Field sales are NOT marketplace orders: no buyer business, no gateway payment, no stock effect in v1.

export const fieldSellers = pgTable(
  'field_sellers',
  {
    id: id(),
    userId: uuid('user_id').notNull().unique().references(() => users.id),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    status: fieldSellerStatus('status').notNull().default('ACTIVE'),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('field_sellers_org_idx').on(t.orgId)],
);

export const fieldSales = pgTable(
  'field_sales',
  {
    id: id(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    fieldSellerId: uuid('field_seller_id').notNull().references(() => fieldSellers.id),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    paymentMethod: fieldPaymentMethod('payment_method').notNull().default('CASH'),
    totalPaisa: paisa('total_paisa').notNull(),
    status: fieldSaleStatus('status').notNull().default('ACTIVE'),
    voidReason: text('void_reason'),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    note: text('note'),
    soldAt: timestamp('sold_at', { withTimezone: true }).notNull().defaultNow(), // server time only
    createdAt: createdAt(),
  },
  (t) => [
    index('field_sales_org_sold_idx').on(t.orgId, t.soldAt),
    index('field_sales_seller_sold_idx').on(t.fieldSellerId, t.soldAt),
    check('field_sales_void_reason_chk', sql`${t.status} <> 'VOIDED' OR ${t.voidReason} IS NOT NULL`),
  ],
);

export const fieldSaleItems = pgTable(
  'field_sale_items',
  {
    id: id(),
    saleId: uuid('sale_id').notNull().references(() => fieldSales.id),
    variantId: uuid('variant_id').notNull().references(() => productVariants.id),
    nameSnapshot: text('name_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot').notNull(),
    unitPricePaisa: integer('unit_price_paisa').notNull(), // snapshotted from the catalog by the server
    qty: integer('qty').notNull(),
  },
  (t) => [index('field_sale_items_sale_idx').on(t.saleId), check('field_sale_items_qty_chk', sql`${t.qty} > 0`)],
);
