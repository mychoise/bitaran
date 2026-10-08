import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrgContextGuard } from './common/guards/org-context.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, DrizzleDB } from './db/db.module';
import * as request from 'supertest';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import {
  users,
  organizations,
  roles,
  memberships,
  addresses,
  categories,
  products,
  productVariants,
  inventoryItems,
  orders,
  carts,
  cartItems,
} from './db/schema';
import * as bcrypt from 'bcrypt';

describe('Bitaran Marketplace Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let testPool: Pool;

  // Test entities
  let seller1Token: string;
  let seller1OrgId: string;
  let seller2Token: string;
  let seller2OrgId: string;
  let buyerToken: string;
  let buyerOrgId: string;
  let buyerAddressId: string;

  let seller1VariantId: string;
  let seller2VariantId: string;
  let limitedVariantId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/bitaran_test';
    testPool = new Pool({ connectionString: testDbUrl });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    const reflector = app.get(Reflector);
    const jwtService = app.get(JwtService);
    const configService = app.get(ConfigService);
    db = app.get<DrizzleDB>(DRIZZLE);

    app.useGlobalGuards(
      new JwtAuthGuard(jwtService, configService, reflector),
      new OrgContextGuard(db, reflector),
      new PermissionsGuard(reflector),
    );

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new BigIntSerializerInterceptor());

    await app.init();

    // Clean up test database tables
    await testPool.query(`
      TRUNCATE TABLE
        shipment_events, shipments, payment_events, payments,
        order_status_history, order_items, orders, checkouts,
        cart_items, carts, stock_movements, inventory_items,
        product_images, product_variants, products, categories,
        addresses, memberships, refresh_tokens, organizations, users, roles
      CASCADE;
    `);

    // Setup base roles
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const [ownerRole] = await db
      .insert(roles)
      .values({
        name: 'OWNER',
        permissions: ['product.view', 'product.edit', 'order.view', 'order.accept'],
      })
      .returning();

    const [adminRole] = await db
      .insert(roles)
      .values({
        name: 'ADMIN',
        permissions: ['org.view', 'org.approve', 'category.edit', 'order.view.all', 'shipment.update'],
      })
      .returning();

    // Create Category
    const [cat] = await db.insert(categories).values({ name: 'General Goods' }).returning();

    // Helper to create user, org, membership & login
    async function createUserOrg(name: string, email: string, canBuy: boolean, canSell: boolean) {
      const [u] = await db.insert(users).values({
        name,
        email,
        passwordHash,
        status: 'ACTIVE',
      }).returning();

      const [o] = await db.insert(organizations).values({
        name: `${name} Business`,
        canBuy,
        canSell,
        status: 'APPROVED',
        type: 'BUSINESS',
      }).returning();

      await db.insert(memberships).values({
        userId: u.id,
        orgId: o.id,
        roleId: ownerRole.id,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123!' });

      return {
        userId: u.id,
        orgId: o.id,
        token: res.body.tokens.accessToken as string,
      };
    }

    const s1 = await createUserOrg('Seller One', 's1@test.com', false, true);
    seller1OrgId = s1.orgId;
    seller1Token = s1.token;

    const s2 = await createUserOrg('Seller Two', 's2@test.com', false, true);
    seller2OrgId = s2.orgId;
    seller2Token = s2.token;

    const b = await createUserOrg('Buyer One', 'buyer@test.com', true, false);
    buyerOrgId = b.orgId;
    buyerToken = b.token;

    // Buyer address
    const [addr] = await db.insert(addresses).values({
      orgId: buyerOrgId,
      label: 'Store',
      line1: '123 Market St',
      city: 'Kathmandu',
      district: 'Kathmandu',
      phone: '9800000000',
      isDefault: true,
    }).returning();
    buyerAddressId = addr.id;

    // Seller 1 Product
    const [p1] = await db.insert(products).values({
      sellerOrgId: seller1OrgId,
      categoryId: cat.id,
      name: 'Product S1',
      status: 'ACTIVE',
    }).returning();

    const [v1] = await db.insert(productVariants).values({
      productId: p1.id,
      sku: 'SKU-S1',
      unit: 'piece',
      pricePaisa: 10000, // Rs 100
      minOrderQty: 1,
    }).returning();
    seller1VariantId = v1.id;

    await db.insert(inventoryItems).values({
      variantId: v1.id,
      qtyOnHand: 100,
      qtyReserved: 0,
    });

    // Seller 2 Product
    const [p2] = await db.insert(products).values({
      sellerOrgId: seller2OrgId,
      categoryId: cat.id,
      name: 'Product S2',
      status: 'ACTIVE',
    }).returning();

    const [v2] = await db.insert(productVariants).values({
      productId: p2.id,
      sku: 'SKU-S2',
      unit: 'piece',
      pricePaisa: 25000, // Rs 250
      minOrderQty: 1,
    }).returning();
    seller2VariantId = v2.id;

    await db.insert(inventoryItems).values({
      variantId: v2.id,
      qtyOnHand: 50,
      qtyReserved: 0,
    });

    // Limited Stock Variant for concurrent testing (5 units total)
    const [pLim] = await db.insert(products).values({
      sellerOrgId: seller1OrgId,
      categoryId: cat.id,
      name: 'Limited Product',
      status: 'ACTIVE',
    }).returning();

    const [vLim] = await db.insert(productVariants).values({
      productId: pLim.id,
      sku: 'SKU-LIM-5',
      unit: 'piece',
      pricePaisa: 5000,
      minOrderQty: 1,
    }).returning();
    limitedVariantId = vLim.id;

    await db.insert(inventoryItems).values({
      variantId: vLim.id,
      qtyOnHand: 5,
      qtyReserved: 0,
    });
  });

  afterAll(async () => {
    await app.close();
    await testPool.end();
  });

  describe('1. Tenant Isolation', () => {
    it('seller A cannot modify seller B product', async () => {
      // Seller 2 attempts to edit Seller 1's product
      const [s1Prod] = await db
        .select()
        .from(products)
        .where(sql`${products.sellerOrgId} = ${seller1OrgId}`)
        .limit(1);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${s1Prod.id}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .set('X-Org-Id', seller2OrgId)
        .send({
          name: 'Hacked Product Name',
        });

      expect([403, 404]).toContain(res.status);
    });

    it('seller B cannot read or manage seller A incoming orders', async () => {
      // Create a dummy order for seller 1
      // Seller 2 calls /orders/seller to view incoming orders
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/seller')
        .set('Authorization', `Bearer ${seller2Token}`)
        .set('X-Org-Id', seller2OrgId);

      expect(res.status).toBe(200);
      // All returned orders must belong only to seller2
      const items = res.body as Array<{ sellerOrgId: string }>;
      for (const order of items) {
        expect(order.sellerOrgId).toBe(seller2OrgId);
      }
    });
  });

  describe('2. Multi-Seller Checkout & Order Splitting', () => {
    it('checkout with two sellers creates two separate orders with accurate totals', async () => {
      // 1. Add item from seller 1 (qty: 2 @ 10000 paisa = 20000 paisa)
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ variantId: seller1VariantId, qty: 2 })
        .expect(201);

      // 2. Add item from seller 2 (qty: 3 @ 25000 paisa = 75000 paisa)
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ variantId: seller2VariantId, qty: 3 })
        .expect(201);

      // 3. Checkout
      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({
          addressId: buyerAddressId,
          paymentProvider: 'ESEWA',
        })
        .expect(201);

      expect(checkoutRes.body.checkoutId).toBeDefined();
      expect(checkoutRes.body.orders).toHaveLength(2);

      // Total must be 20000 + 75000 = 95000 paisa
      expect(BigInt(checkoutRes.body.totalPaisa)).toBe(95000n);

      const orderS1 = checkoutRes.body.orders.find((o: any) => o.sellerOrgId === seller1OrgId);
      const orderS2 = checkoutRes.body.orders.find((o: any) => o.sellerOrgId === seller2OrgId);

      expect(orderS1).toBeDefined();
      expect(orderS2).toBeDefined();
      expect(BigInt(orderS1.totalPaisa)).toBe(20000n);
      expect(BigInt(orderS2.totalPaisa)).toBe(75000n);
      expect(orderS1.status).toBe('PAYMENT_PENDING');
      expect(orderS2.status).toBe('PAYMENT_PENDING');
    });
  });

  describe('3. Concurrent Checkouts for Last Units', () => {
    it('only one checkout succeeds for last units and stock never goes negative', async () => {
      // Create a second buyer
      const b2 = await (async () => {
        const passwordHash = await bcrypt.hash('Password123!', 10);
        const [u] = await db.insert(users).values({
          name: 'Buyer Two',
          email: 'buyer2@test.com',
          passwordHash,
          status: 'ACTIVE',
        }).returning();

        const [o] = await db.insert(organizations).values({
          name: 'Buyer Two Business',
          canBuy: true,
          canSell: false,
          status: 'APPROVED',
          type: 'BUSINESS',
        }).returning();

        const [ownerRole] = await db.select().from(roles).where(sql`${roles.name} = 'OWNER'`).limit(1);
        await db.insert(memberships).values({
          userId: u.id,
          orgId: o.id,
          roleId: ownerRole.id,
        });

        const [addr] = await db.insert(addresses).values({
          orgId: o.id,
          label: 'Default',
          line1: '456 Ring Rd',
          city: 'Kathmandu',
          phone: '9811111111',
          isDefault: true,
        }).returning();

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'buyer2@test.com', password: 'Password123!' });

        return {
          orgId: o.id,
          token: res.body.tokens.accessToken as string,
          addressId: addr.id,
        };
      })();

      // Both buyer 1 and buyer 2 add all 5 available units of limitedVariantId to their carts
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ variantId: limitedVariantId, qty: 5 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${b2.token}`)
        .set('X-Org-Id', b2.orgId)
        .send({ variantId: limitedVariantId, qty: 5 })
        .expect(201);

      // Concurrent checkout requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/checkout')
          .set('Authorization', `Bearer ${buyerToken}`)
          .set('X-Org-Id', buyerOrgId)
          .send({ addressId: buyerAddressId, paymentProvider: 'ESEWA' }),
        request(app.getHttpServer())
          .post('/api/v1/checkout')
          .set('Authorization', `Bearer ${b2.token}`)
          .set('X-Org-Id', b2.orgId)
          .send({ addressId: b2.addressId, paymentProvider: 'ESEWA' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (201) and the other must fail (400)
      expect(statuses).toEqual([201, 400]);

      // Verify DB inventory constraints: qtyOnHand = 5, qtyReserved = 5, never > 5
      const [inv] = await db
        .select()
        .from(inventoryItems)
        .where(sql`${inventoryItems.variantId} = ${limitedVariantId}`)
        .limit(1);

      expect(inv.qtyOnHand).toBe(5);
      expect(inv.qtyReserved).toBe(5);
    });
  });

  describe('4. Payment Callback Idempotency', () => {
    it('duplicate payment callback does not duplicate payment or fail idempotency', async () => {
      // 1. Place an order to obtain a payment record
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ variantId: seller1VariantId, qty: 1 })
        .expect(201);

      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ addressId: buyerAddressId, paymentProvider: 'KHALTI' })
        .expect(201);

      const payment = checkoutRes.body.payments[0];
      expect(payment).toBeDefined();

      // First callback: action = pay
      const cb1 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback')
        .send({ paymentId: payment.id, action: 'pay' });

      expect(cb1.status).toBe(200);
      expect(cb1.body.status).toBe('VERIFIED');

      // Second callback: repeated action = pay
      const cb2 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback')
        .send({ paymentId: payment.id, action: 'pay' });

      expect(cb2.status).toBe(200);
      expect(cb2.body.status).toBe('VERIFIED');

      // Verify order is PAID
      const [order] = await db
        .select()
        .from(orders)
        .where(sql`${orders.id} = ${payment.orderId}`)
        .limit(1);

      expect(order.status).toBe('PAID');
    });
  });

  describe('5. State Machine Validation', () => {
    it('invalid order transitions return 409', async () => {
      // Create a paid order
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ variantId: seller1VariantId, qty: 1 })
        .expect(201);

      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('X-Org-Id', buyerOrgId)
        .send({ addressId: buyerAddressId, paymentProvider: 'ESEWA' })
        .expect(201);

      const order = checkoutRes.body.orders[0];

      // Mark it PAID via callback
      await request(app.getHttpServer())
        .post('/api/v1/payments/callback')
        .send({ paymentId: checkoutRes.body.payments[0].id, action: 'pay' })
        .expect(200);

      // Attempt invalid transition directly from PAID to DELIVERED (must go PAID -> CONFIRMED -> READY_FOR_PICKUP -> IN_DELIVERY -> DELIVERED)
      const orderId = order.orderId || order.id;
      const invalidRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/transition`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .set('X-Org-Id', seller1OrgId)
        .send({ toStatus: 'DELIVERED' });

      expect(invalidRes.status).toBe(409);
    });
  });

  describe('6. Self-Purchasing Restriction', () => {
    it('a buyer cannot order from their own organization', async () => {
      // Create an org with both canBuy = true and canSell = true
      const bothUser = await (async () => {
        const passwordHash = await bcrypt.hash('Password123!', 10);
        const [u] = await db.insert(users).values({
          name: 'Dual Trader',
          email: 'dual@test.com',
          passwordHash,
          status: 'ACTIVE',
        }).returning();

        const [o] = await db.insert(organizations).values({
          name: 'Dual Trader Enterprise',
          canBuy: true,
          canSell: true,
          status: 'APPROVED',
          type: 'BUSINESS',
        }).returning();

        const [ownerRole] = await db.select().from(roles).where(sql`${roles.name} = 'OWNER'`).limit(1);
        await db.insert(memberships).values({
          userId: u.id,
          orgId: o.id,
          roleId: ownerRole.id,
        });

        const [addr] = await db.insert(addresses).values({
          orgId: o.id,
          label: 'HQ',
          line1: '99 Main St',
          city: 'Lalitpur',
          phone: '9822222222',
          isDefault: true,
        }).returning();

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'dual@test.com', password: 'Password123!' });

        return {
          orgId: o.id,
          token: res.body.tokens.accessToken as string,
          addressId: addr.id,
        };
      })();

      // List a product for Dual Trader
      const [cat] = await db.select().from(categories).limit(1);
      const [ownProduct] = await db.insert(products).values({
        sellerOrgId: bothUser.orgId,
        categoryId: cat.id,
        name: 'Own Product',
        status: 'ACTIVE',
      }).returning();

      const [ownVariant] = await db.insert(productVariants).values({
        productId: ownProduct.id,
        sku: 'OWN-SKU-1',
        unit: 'piece',
        pricePaisa: 5000,
        minOrderQty: 1,
      }).returning();

      await db.insert(inventoryItems).values({
        variantId: ownVariant.id,
        qtyOnHand: 20,
        qtyReserved: 0,
      });

      // 1. Attempt to put own product in cart -> rejected with 400
      const addToCartRes = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${bothUser.token}`)
        .set('X-Org-Id', bothUser.orgId)
        .send({ variantId: ownVariant.id, qty: 1 });

      expect(addToCartRes.status).toBe(400);

      // 2. Direct cart insertion bypass test -> checkout itself rejects with 400
      const [buyerCart] = await db
        .select()
        .from(carts)
        .where(sql`${carts.buyerOrgId} = ${bothUser.orgId}`)
        .limit(1);

      let cartId = buyerCart?.id;
      if (!cartId) {
        const [c] = await db.insert(carts).values({ buyerOrgId: bothUser.orgId }).returning();
        cartId = c.id;
      }

      await db.insert(cartItems).values({ cartId, variantId: ownVariant.id, qty: 1 });

      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${bothUser.token}`)
        .set('X-Org-Id', bothUser.orgId)
        .send({
          addressId: bothUser.addressId,
          paymentProvider: 'ESEWA',
        });

      // Must be rejected with 400
      expect([400, 403]).toContain(checkoutRes.status);
    });
  });

  describe('7. Business Verification & Approval Restrictions', () => {
    it('unapproved / pending seller cannot create products', async () => {
      // Create a PENDING seller org
      const passwordHash = await bcrypt.hash('Password123!', 10);
      const [u] = await db.insert(users).values({
        name: 'Pending Seller',
        email: 'pending_seller@test.com',
        passwordHash,
        status: 'ACTIVE',
      }).returning();

      const [pendingOrg] = await db.insert(organizations).values({
        name: 'Pending Seller Business',
        canBuy: false,
        canSell: true,
        status: 'PENDING',
        type: 'BUSINESS',
      }).returning();

      const [ownerRole] = await db.select().from(roles).where(sql`${roles.name} = 'OWNER'`).limit(1);

      await db.insert(memberships).values({
        userId: u.id,
        orgId: pendingOrg.id,
        roleId: ownerRole.id,
      });

      // Login to obtain token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pending_seller@test.com', password: 'Password123!' });

      const token = loginRes.body.tokens.accessToken;

      const [cat] = await db.select().from(categories).limit(1);

      // Attempt to create product
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Org-Id', pendingOrg.id)
        .send({
          name: 'Unauthorized Product',
          categoryId: cat.id,
          description: 'Should fail',
          variants: [
            {
              sku: 'UNAUTH-SKU-1',
              unit: 'PIECE',
              packSize: 1,
              pricePaisa: 10000,
              minOrderQty: 1,
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('approval');
    });

    it('unapproved / pending buyer cannot place checkout orders', async () => {
      // Create a PENDING buyer org
      const passwordHash = await bcrypt.hash('Password123!', 10);
      const [u] = await db.insert(users).values({
        name: 'Pending Buyer',
        email: 'pending_buyer@test.com',
        passwordHash,
        status: 'ACTIVE',
      }).returning();

      const [pendingBuyerOrg] = await db.insert(organizations).values({
        name: 'Pending Buyer Business',
        canBuy: true,
        canSell: false,
        status: 'PENDING',
        type: 'BUSINESS',
      }).returning();

      const [ownerRole] = await db.select().from(roles).where(sql`${roles.name} = 'OWNER'`).limit(1);

      await db.insert(memberships).values({
        userId: u.id,
        orgId: pendingBuyerOrg.id,
        roleId: ownerRole.id,
      });

      const [buyerAddr] = await db.insert(addresses).values({
        orgId: pendingBuyerOrg.id,
        label: 'Pending Warehouse',
        line1: 'Kathmandu Rd',
        city: 'Kathmandu',
        district: 'Kathmandu',
        phone: '9800000000',
        isDefault: true,
      }).returning();

      // Login to obtain token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pending_buyer@test.com', password: 'Password123!' });

      const token = loginRes.body.tokens.accessToken;

      // Add item to cart directly in DB
      const [cart] = await db.insert(carts).values({ buyerOrgId: pendingBuyerOrg.id }).returning();
      await db.insert(cartItems).values({ cartId: cart.id, variantId: seller1VariantId, qty: 10 });

      // Attempt checkout
      const res = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Org-Id', pendingBuyerOrg.id)
        .send({
          addressId: buyerAddr.id,
          paymentProvider: 'ESEWA',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('approval');
    });
  });
});
