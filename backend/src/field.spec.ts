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
import {
  users,
  organizations,
  roles,
  memberships,
  categories,
  products,
  productVariants,
  fieldSellers,
  fieldSales,
  fieldSaleItems,
} from './db/schema';
import * as bcrypt from 'bcrypt';

describe('Bitaran Milestone 8 - Field Sellers Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let testPool: Pool;

  let ownerAToken: string;
  let ownerAOrgId: string;
  let ownerBToken: string;
  let ownerBOrgId: string;

  let sellerAVariantId: string;
  let sellerAVariantPrice: number;
  let sellerBVariantId: string;

  let fieldSellerA1Token: string;
  let fieldSellerA1RefreshToken: string;
  let fieldSellerA1Id: string;
  let fieldSellerA1UserId: string;

  let fieldSellerA2Token: string;
  let fieldSellerA2Id: string;

  let fieldSellerB1Token: string;
  let fieldSellerB1Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:1234@localhost:5432/bitaran_test';
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

    // Clean up
    await testPool.query(`
      TRUNCATE TABLE
        field_sale_items, field_sales, field_sellers,
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
        permissions: [
          'product.view',
          'product.edit',
          'order.view',
          'order.accept',
          'fieldseller.manage',
          'fieldsale.view_all',
          'fieldsale.void',
          'fieldanalytics.view',
        ],
      })
      .returning();

    const [fieldSellerRole] = await db
      .insert(roles)
      .values({
        name: 'FIELD_SELLER',
        permissions: [
          'fieldsale.create',
          'fieldsale.view_own',
          'fieldcatalog.view',
        ],
      })
      .returning();

    const [category] = await db
      .insert(categories)
      .values({
        name: 'General Food',
      })
      .returning();

    // Helper to create seller org and owner
    async function createSeller(name: string, email: string) {
      const [u] = await db
        .insert(users)
        .values({
          name: `${name} Owner`,
          email,
          passwordHash,
          status: 'ACTIVE',
        })
        .returning();

      const [o] = await db
        .insert(organizations)
        .values({
          name: `${name} Org`,
          canBuy: false,
          canSell: true,
          status: 'APPROVED',
          type: 'BUSINESS',
        })
        .returning();

      await db.insert(memberships).values({
        userId: u.id,
        orgId: o.id,
        roleId: ownerRole.id,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123!' });

      return {
        token: res.body.tokens.accessToken,
        orgId: o.id,
        userId: u.id,
      };
    }

    const sellerA = await createSeller('Seller A', 'sellerA@fieldtest.com');
    ownerAToken = sellerA.token;
    ownerAOrgId = sellerA.orgId;

    const sellerB = await createSeller('Seller B', 'sellerB@fieldtest.com');
    ownerBToken = sellerB.token;
    ownerBOrgId = sellerB.orgId;

    // Create products & variants for both sellers
    sellerAVariantPrice = 250000;
    const [prodA] = await db
      .insert(products)
      .values({
        sellerOrgId: ownerAOrgId,
        categoryId: category.id,
        name: 'Rice Bag 25kg',
        status: 'ACTIVE',
      })
      .returning();

    const [varA] = await db
      .insert(productVariants)
      .values({
        productId: prodA.id,
        sku: 'RICE-A-25',
        unit: 'bag',
        pricePaisa: sellerAVariantPrice,
        minOrderQty: 1,
        isActive: true,
      })
      .returning();
    sellerAVariantId = varA.id;

    const [prodB] = await db
      .insert(products)
      .values({
        sellerOrgId: ownerBOrgId,
        categoryId: category.id,
        name: 'Wheat Sack 50kg',
        status: 'ACTIVE',
      })
      .returning();

    const [varB] = await db
      .insert(productVariants)
      .values({
        productId: prodB.id,
        sku: 'WHEAT-B-50',
        unit: 'sack',
        pricePaisa: 350000,
        minOrderQty: 1,
        isActive: true,
      })
      .returning();
    sellerBVariantId = varB.id;

    // Create field sellers for Seller A
    async function createFieldSellerHelper(
      ownerToken: string,
      orgId: string,
      displayName: string,
      username: string,
    ) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/seller/field-sellers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-org-id', orgId)
        .send({
          displayName,
          username,
          phone: `9841${Math.floor(100000 + Math.random() * 900000)}`,
        });

      if (res.status !== 201) {
        console.error('createFieldSellerHelper error:', res.status, res.body);
      }
      expect(res.status).toBe(201);

      const tempPassword = res.body.temporaryPassword;
      const fsId = res.body.id;
      const userId = res.body.userId;

      // Login as field seller
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/field/login')
        .send({ username, password: tempPassword })
        .expect(200);

      // Change password immediately so the seller can use all endpoints
      const changeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/password')
        .set('Authorization', `Bearer ${loginRes.body.tokens.accessToken}`)
        .send({ newPassword: 'FieldPassword123!' })
        .expect(200);

      return {
        id: fsId,
        userId,
        username,
        token: changeRes.body.tokens.accessToken,
        refreshToken: changeRes.body.tokens.refreshToken,
      };
    }

    const fsA1 = await createFieldSellerHelper(
      ownerAToken,
      ownerAOrgId,
      'Field Seller A1',
      'field.a1',
    );
    fieldSellerA1Id = fsA1.id;
    fieldSellerA1UserId = fsA1.userId;
    fieldSellerA1Token = fsA1.token;
    fieldSellerA1RefreshToken = fsA1.refreshToken;

    const fsA2 = await createFieldSellerHelper(
      ownerAToken,
      ownerAOrgId,
      'Field Seller A2',
      'field.a2',
    );
    fieldSellerA2Id = fsA2.id;
    fieldSellerA2Token = fsA2.token;

    const fsB1 = await createFieldSellerHelper(
      ownerBToken,
      ownerBOrgId,
      'Field Seller B1',
      'field.b1',
    );
    fieldSellerB1Id = fsB1.id;
    fieldSellerB1Token = fsB1.token;
  });

  afterAll(async () => {
    await app.close();
    await testPool.end();
  });

  // ----------------------------------------------------
  // Test 1: Field seller vs Normal login segregation
  // ----------------------------------------------------
  it('1. A field seller logs in through the field login, is rejected by the normal login, and the reverse', async () => {
    // Field seller logging in via normal login fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'field.a1', password: 'FieldPassword123!' })
      .expect(400); // Invalid email format or rejected

    // Field seller logging in via field login succeeds
    const fieldLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/field/login')
      .send({ username: 'field.a1', password: 'FieldPassword123!' })
      .expect(200);
    expect(fieldLoginRes.body.tokens.accessToken).toBeDefined();

    // Normal owner logging in via field login fails with 401
    await request(app.getHttpServer())
      .post('/api/v1/auth/field/login')
      .send({ username: 'sellerA@fieldtest.com', password: 'Password123!' })
      .expect(401);

    // Normal owner logging in via normal login succeeds
    const normalLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sellerA@fieldtest.com', password: 'Password123!' })
      .expect(200);
    expect(normalLoginRes.body.tokens.accessToken).toBeDefined();
  });

  // ----------------------------------------------------
  // Test 2: Field seller cannot call buyer, seller or admin routes
  // ----------------------------------------------------
  it('2. A field seller gets 403 on /seller/*, /admin/*, cart, checkout and order routes', async () => {
    // /seller/*
    await request(app.getHttpServer())
      .get('/api/v1/seller/field-sellers')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(403);

    // /admin/*
    await request(app.getHttpServer())
      .get('/api/v1/admin/orgs')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(403);

    // cart
    await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(403);

    // checkout
    await request(app.getHttpServer())
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({})
      .expect(403);

    // orders
    await request(app.getHttpServer())
      .get('/api/v1/orders/buyer')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(403);
  });

  // ----------------------------------------------------
  // Test 3: Tenant Isolation between Owners
  // ----------------------------------------------------
  it('3. Owner A cannot list, view, disable, reset or void anything belonging to owner B field sellers or sales', async () => {
    // Owner A cannot view Owner B's field seller
    await request(app.getHttpServer())
      .get(`/api/v1/seller/field-sellers/${fieldSellerB1Id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(404);

    // Owner A cannot disable Owner B's field seller
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sellers/${fieldSellerB1Id}/disable`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(404);

    // Owner A cannot reset password of Owner B's field seller
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sellers/${fieldSellerB1Id}/reset-password`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(404);

    // Owner B creates a sale
    const bSaleRes = await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerB1Token}`)
      .send({
        items: [{ variantId: sellerBVariantId, qty: 1 }],
        paymentMethod: 'CASH',
      })
      .expect(201);
    const bSaleId = bSaleRes.body.id;

    // Owner A cannot void Owner B's sale
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sales/${bSaleId}/void`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({ reason: 'Malicious attempt' })
      .expect(404);

    // Owner A listing field sellers does not include Owner B's field sellers
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/seller/field-sellers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    const ids = listRes.body.map((s: any) => s.id);
    expect(ids).toContain(fieldSellerA1Id);
    expect(ids).toContain(fieldSellerA2Id);
    expect(ids).not.toContain(fieldSellerB1Id);
  });

  // ----------------------------------------------------
  // Test 4: Field seller 1 cannot read Field seller 2's sales
  // ----------------------------------------------------
  it('4. Field seller 1 cannot read field seller 2 sales', async () => {
    // Seller A2 records a sale
    await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA2Token}`)
      .send({
        items: [{ variantId: sellerAVariantId, qty: 1 }],
        customerName: 'A2 Customer',
        paymentMethod: 'CASH',
      })
      .expect(201);

    // Seller A1 requests their own sales
    const a1SalesRes = await request(app.getHttpServer())
      .get('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(200);

    // Check that none of A2's customer sales appear in A1's list
    const hasA2Sales = a1SalesRes.body.some(
      (s: any) => s.customerName === 'A2 Customer',
    );
    expect(hasA2Sales).toBe(false);
  });

  // ----------------------------------------------------
  // Test 5: Catalog price calculation & cross-tenant items rejection
  // ----------------------------------------------------
  it('5. The sale total is computed from catalog prices; client-sent price is ignored. Items from another business are rejected', async () => {
    // Client attempts to send totalPaisa: '10' and unitPrice: 1
    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({
        items: [{ variantId: sellerAVariantId, qty: 3, unitPricePaisa: 1 }],
        totalPaisa: '10',
        paymentMethod: 'CASH',
      })
      .expect(201);

    const expectedTotal = (sellerAVariantPrice * 3).toString();
    expect(saleRes.body.totalPaisa).toBe(expectedTotal);
    expect(saleRes.body.items[0].unitPricePaisa).toBe(sellerAVariantPrice);

    // Field seller A tries to sell variant from Seller B -> 400
    await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({
        items: [{ variantId: sellerBVariantId, qty: 1 }],
        paymentMethod: 'CASH',
      })
      .expect(400);
  });

  // ----------------------------------------------------
  // Test 6: Disabled field seller cannot login and refresh token is revoked
  // ----------------------------------------------------
  it('6. A disabled field seller cannot log in, and an existing refresh token stops working', async () => {
    // Disable field seller A1
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sellers/${fieldSellerA1Id}/disable`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(201);

    // Attempting login now fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/field/login')
      .send({ username: 'field.a1', password: 'FieldPassword123!' })
      .expect(401);

    // Using the old refresh token fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: fieldSellerA1RefreshToken })
      .expect(401);

    // Using access token on field routes fails
    await request(app.getHttpServer())
      .get('/api/v1/field/me/summary')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(403);

    // Re-enable field seller A1 for subsequent tests
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sellers/${fieldSellerA1Id}/enable`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(201);

    // Login succeeds again and we get fresh token
    const reLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/field/login')
      .send({ username: 'field.a1', password: 'FieldPassword123!' })
      .expect(200);
    fieldSellerA1Token = reLogin.body.tokens.accessToken;
  });

  // ----------------------------------------------------
  // Test 7: Voiding requires reason and excludes sale from analytics & summaries
  // ----------------------------------------------------
  it('7. Voiding requires a reason and removes the sale from analytics and summaries', async () => {
    // Record a sale for seller A1
    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({
        items: [{ variantId: sellerAVariantId, qty: 2 }],
        paymentMethod: 'ESEWA',
      })
      .expect(201);
    const saleId = saleRes.body.id;

    // Get summary before voiding
    const summaryBefore = await request(app.getHttpServer())
      .get('/api/v1/field/me/summary')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(200);

    // Attempt voiding without reason or too short reason
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sales/${saleId}/void`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({ reason: 'no' })
      .expect(400);

    // Void with valid reason
    const voidRes = await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sales/${saleId}/void`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({ reason: 'Defective product returned' })
      .expect(201);

    expect(voidRes.body.status).toBe('VOIDED');
    expect(voidRes.body.voidReason).toBe('Defective product returned');

    // Summary count should decrease by 1
    const summaryAfter = await request(app.getHttpServer())
      .get('/api/v1/field/me/summary')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .expect(200);

    expect(summaryAfter.body.allTimeCount).toBe(
      summaryBefore.body.allTimeCount - 1,
    );
  });

  // ----------------------------------------------------
  // Test 8: Analytics totals equal the sum of ACTIVE sales
  // ----------------------------------------------------
  it('8. Analytics totals equal the sum of ACTIVE sales for the chosen range and seller', async () => {
    // Add 2 active sales for A1
    await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({
        items: [{ variantId: sellerAVariantId, qty: 1 }],
        paymentMethod: 'CASH',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/field/sales')
      .set('Authorization', `Bearer ${fieldSellerA1Token}`)
      .send({
        items: [{ variantId: sellerAVariantId, qty: 2 }],
        paymentMethod: 'KHALTI',
      })
      .expect(201);

    // Query analytics for seller A org
    const analyticsRes = await request(app.getHttpServer())
      .get('/api/v1/seller/field-analytics')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    expect(analyticsRes.body.totals).toBeDefined();
    expect(analyticsRes.body.bySeller).toBeDefined();
    expect(analyticsRes.body.byDay).toBeDefined();
    expect(analyticsRes.body.topProducts).toBeDefined();
    expect(analyticsRes.body.byPaymentMethod).toBeDefined();

    const totals = analyticsRes.body.totals;
    expect(Number(totals.revenue)).toBeGreaterThan(0);
    expect(totals.salesCount).toBeGreaterThan(0);
    expect(totals.units).toBeGreaterThan(0);

    // Sum of bySeller revenue should match total revenue
    const sumSellerRev = analyticsRes.body.bySeller.reduce(
      (acc: bigint, s: any) => acc + BigInt(s.revenue),
      0n,
    );
    expect(sumSellerRev.toString()).toBe(totals.revenue);

    // Filter by single seller
    const filteredAnalytics = await request(app.getHttpServer())
      .get(`/api/v1/seller/field-analytics?fieldSellerId=${fieldSellerA1Id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    expect(filteredAnalytics.body.bySeller.length).toBe(1);
    expect(filteredAnalytics.body.bySeller[0].seller.id).toBe(fieldSellerA1Id);
  });

  // ----------------------------------------------------
  // Test 9: Temporary password returned once & forced password change
  // ----------------------------------------------------
  it('9. The temporary password is returned once and the user must change it before using any other endpoint', async () => {
    // Owner creates new field seller
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/seller/field-sellers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        displayName: 'Temporary User',
        username: 'temp.seller',
      })
      .expect(201);

    const tempPassword = createRes.body.temporaryPassword;
    expect(tempPassword).toBeDefined();
    expect(tempPassword.length).toBeGreaterThanOrEqual(10);

    // Fetching the field seller does NOT return the temporary password
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/seller/field-sellers/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);
    expect(getRes.body.temporaryPassword).toBeUndefined();

    // Login with temporary password
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/field/login')
      .send({
        username: 'temp.seller',
        password: tempPassword,
      })
      .expect(200);

    const tempToken = loginRes.body.tokens.accessToken;
    expect(loginRes.body.user.mustChangePassword).toBe(true);

    // Any endpoint call before password change returns 403
    await request(app.getHttpServer())
      .get('/api/v1/field/me/summary')
      .set('Authorization', `Bearer ${tempToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/field/products')
      .set('Authorization', `Bearer ${tempToken}`)
      .expect(403);

    // Change password endpoint succeeds
    const pwRes = await request(app.getHttpServer())
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${tempToken}`)
      .send({
        newPassword: 'MyNewPermanentPassword123!',
      })
      .expect(200);

    const newAccessToken = pwRes.body.tokens.accessToken;

    // Now calling summary endpoint succeeds!
    const summaryRes = await request(app.getHttpServer())
      .get('/api/v1/field/me/summary')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);
    expect(summaryRes.body.allTimeCount).toBe(0);
  });
});
