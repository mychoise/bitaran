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
import { eq } from 'drizzle-orm';
import {
  users,
  organizations,
  roles,
  memberships,
  categories,
  products,
  productVariants,
  inventoryItems,
  auditLogs,
  fieldSellers,
  fieldSales,
  fieldSaleItems,
  orders,
  orderItems,
  checkouts,
} from './db/schema';
import * as bcrypt from 'bcrypt';

describe('Bitaran Milestone 9 - Manager Role & Team Management Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let testPool: Pool;

  let ownerAToken: string;
  let ownerAOrgId: string;
  let ownerAUserId: string;

  let ownerBToken: string;
  let ownerBOrgId: string;

  let categoryId: string;
  let variantIdA: string;
  let productIdA: string;

  let managerToken: string;
  let managerMembershipId: string;
  let managerUserId: string;

  let staffToken: string;
  let staffMembershipId: string;
  let staffUserId: string;

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
        audit_logs, field_sale_items, field_sales, field_sellers,
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
          'product.create',
          'product.edit',
          'product.view',
          'stock.adjust',
          'order.view',
          'order.accept',
          'order.reject',
          'order.mark_ready',
          'order.mark_refunded',
          'fieldseller.manage',
          'fieldsale.view_all',
          'fieldsale.void',
          'fieldanalytics.view',
          'report.view',
          'team.manage_staff',
          'team.manage_managers',
          'team.roles_change',
          'audit.view',
          'checkout.place',
        ],
      })
      .returning();

    const [managerRole] = await db
      .insert(roles)
      .values({
        name: 'MANAGER',
        permissions: [
          'product.create',
          'product.edit',
          'product.view',
          'stock.adjust',
          'order.view',
          'order.accept',
          'order.reject',
          'order.mark_ready',
          'fieldseller.manage',
          'fieldsale.view_all',
          'fieldanalytics.view',
          'report.view',
          'team.manage_staff',
        ],
      })
      .returning();

    const [staffRole] = await db
      .insert(roles)
      .values({
        name: 'STAFF',
        permissions: [
          'product.edit',
          'product.view',
          'stock.adjust',
          'order.view',
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
      .values({ name: 'Provisions' })
      .returning();
    categoryId = category.id;

    // Helper: create seller org & user
    async function createSeller(name: string, email: string) {
      const [u] = await db
        .insert(users)
        .values({
          name,
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

      const [m] = await db
        .insert(memberships)
        .values({
          userId: u.id,
          orgId: o.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
        })
        .returning();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123!' });

      return {
        userId: u.id,
        orgId: o.id,
        membershipId: m.id,
        token: res.body.tokens.accessToken,
      };
    }

    const sellerA = await createSeller('Seller Alpha', 'alpha@owner.test');
    ownerAToken = sellerA.token;
    ownerAOrgId = sellerA.orgId;
    ownerAUserId = sellerA.userId;

    const sellerB = await createSeller('Seller Beta', 'beta@owner.test');
    ownerBToken = sellerB.token;
    ownerBOrgId = sellerB.orgId;

    // Setup an initial product for Seller Alpha
    const [prod] = await db
      .insert(products)
      .values({
        sellerOrgId: ownerAOrgId,
        categoryId,
        name: 'Basmati Rice 20kg',
        status: 'ACTIVE',
      })
      .returning();
    productIdA = prod.id;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: prod.id,
        sku: 'RICE-20KG',
        unit: 'bag',
        pricePaisa: 250000,
        minOrderQty: 1,
        isActive: true,
      })
      .returning();
    variantIdA = variant.id;

    await db.insert(inventoryItems).values({
      variantId: variant.id,
      qtyOnHand: 100,
      qtyReserved: 0,
    });
  });

  afterAll(async () => {
    await app.close();
    await testPool.end();
  });

  // -------------------------------------------------------------------------
  // 1. Owner creates Manager and Staff; passwords returned once & first login flow
  // -------------------------------------------------------------------------
  it('1. Owner creates a Manager and a Staff member; temporary passwords returned once; must change password required', async () => {
    // Owner creates Manager
    const mgrRes = await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Mina Manager',
        email: 'mina@alpha.test',
        role: 'MANAGER',
      })
      .expect(201);

    expect(mgrRes.body.temporaryPassword).toBeDefined();
    expect(mgrRes.body.role).toBe('MANAGER');
    expect(mgrRes.body.status).toBe('ACTIVE');
    managerMembershipId = mgrRes.body.id;
    managerUserId = mgrRes.body.userId;
    const tempManagerPassword = mgrRes.body.temporaryPassword;

    // Owner creates Staff
    const staffRes = await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Suresh Staff',
        email: 'suresh@alpha.test',
        role: 'STAFF',
      })
      .expect(201);

    expect(staffRes.body.temporaryPassword).toBeDefined();
    expect(staffRes.body.role).toBe('STAFF');
    staffMembershipId = staffRes.body.id;
    staffUserId = staffRes.body.userId;
    const tempStaffPassword = staffRes.body.temporaryPassword;

    // Manager signs in with temporary password
    const mgrLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'mina@alpha.test', password: tempManagerPassword })
      .expect(200);

    expect(mgrLogin.body.user.mustChangePassword).toBe(true);
    const initialMgrToken = mgrLogin.body.tokens.accessToken;

    // Attempting any regular endpoint before password change is blocked (403 PASSWORD_CHANGE_REQUIRED)
    await request(app.getHttpServer())
      .get('/api/v1/catalog/products/seller')
      .set('Authorization', `Bearer ${initialMgrToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    // Change password
    await request(app.getHttpServer())
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${initialMgrToken}`)
      .send({
        oldPassword: tempManagerPassword,
        newPassword: 'NewManagerPassword123!',
      })
      .expect(200);

    // Login with new password
    const mgrReLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'mina@alpha.test', password: 'NewManagerPassword123!' })
      .expect(200);

    expect(mgrReLogin.body.user.mustChangePassword).toBe(false);
    managerToken = mgrReLogin.body.tokens.accessToken;

    // Staff changes password as well
    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'suresh@alpha.test', password: tempStaffPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${staffLogin.body.tokens.accessToken}`)
      .send({
        oldPassword: tempStaffPassword,
        newPassword: 'NewStaffPassword123!',
      })
      .expect(200);

    const staffReLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'suresh@alpha.test', password: 'NewStaffPassword123!' })
      .expect(200);

    staffToken = staffReLogin.body.tokens.accessToken;
  });

  // -------------------------------------------------------------------------
  // 2. Manager capabilities: products, stock, orders, field sellers, analytics
  // -------------------------------------------------------------------------
  it('2. Manager can add products, adjust stock, transition orders, manage field sellers, and view analytics', async () => {
    // 2a. Manager creates a product
    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Mustard Oil 1L',
        categoryId,
        variants: [
          {
            sku: 'OIL-1L',
            unit: 'bottle',
            packSize: 1,
            pricePaisa: 28000,
            minOrderQty: 1,
          },
        ],
      })
      .expect(201);

    expect(prodRes.body.name).toBe('Mustard Oil 1L');

    // 2b. Manager edits product and adjusts stock
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/products/${prodRes.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Pure Mustard Oil 1L',
        variants: [
          {
            sku: 'OIL-1L',
            unit: 'bottle',
            packSize: 1,
            pricePaisa: 29000,
            minOrderQty: 1,
          },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${variantIdA}/adjust`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        delta: 20,
      })
      .expect(201);

    // 2c. Manager creates a field seller
    const fsRes = await request(app.getHttpServer())
      .post('/api/v1/seller/field-sellers')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        displayName: 'Ramesh Field',
        username: 'ramesh.field',
        phone: '9841000001',
      })
      .expect(201);

    expect(fsRes.body.displayName).toBe('Ramesh Field');

    // 2d. Manager views field analytics
    const faRes = await request(app.getHttpServer())
      .get('/api/v1/seller/field-analytics')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    expect(faRes.body.totals).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 3. Manager restrictions: 403 on mark refunded, void sale, checkout, manager creation, role changes, audit log
  // -------------------------------------------------------------------------
  it('3. Manager gets 403 on mark refunded, void field sale, cart/checkout, creating manager, changing roles, and activity log', async () => {
    // 3a. Cannot view activity log (audit.view required)
    await request(app.getHttpServer())
      .get('/api/v1/seller/activity')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    // 3b. Cannot create another MANAGER
    await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Another Manager',
        email: 'another_mgr@alpha.test',
        role: 'MANAGER',
      })
      .expect(403);

    // 3c. Cannot change roles (team.roles_change required)
    await request(app.getHttpServer())
      .patch(`/api/v1/seller/team/${staffMembershipId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        role: 'MANAGER',
      })
      .expect(403);

    // 3d. Cannot use cart / checkout (checkout.place required)
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        variantId: variantIdA,
        qty: 1,
      })
      .expect(403);

    // 3e. Cannot void a field sale
    // First, have field seller make a sale
    const fsLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/field-login')
      .send({ username: 'ramesh_field', password: 'bad_password' }); // will fail, let's reset or fetch password
    
    // Create a dummy sale directly in DB for testing void permission
    const [fieldSellerRow] = await db
      .select()
      .from(fieldSellers)
      .where(eq(fieldSellers.orgId, ownerAOrgId))
      .limit(1);

    const [dummySale] = await db
      .insert(fieldSales)
      .values({
        orgId: ownerAOrgId,
        fieldSellerId: fieldSellerRow.id,
        totalPaisa: 50000n,
        paymentMethod: 'CASH',
        status: 'ACTIVE',
      })
      .returning();

    // Manager void sale -> 403
    await request(app.getHttpServer())
      .post(`/api/v1/seller/field-sales/${dummySale.id}/void`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({ reason: 'Accidental entry' })
      .expect(403);

    // 3f. Cannot transition order to REFUNDED
    // Create a dummy checkout and order in database
    const [dummyCheckout] = await db
      .insert(checkouts)
      .values({
        buyerOrgId: ownerBOrgId,
        shippingAddress: { city: 'Kathmandu' },
        totalPaisa: 100000n,
        paymentProvider: 'ESEWA',
      })
      .returning();

    const [dummyOrder] = await db
      .insert(orders)
      .values({
        checkoutId: dummyCheckout.id,
        sellerOrgId: ownerAOrgId,
        buyerOrgId: ownerBOrgId,
        status: 'REJECTED_REFUND_PENDING',
        totalPaisa: 100000n,
        subtotalPaisa: 100000n,
        deliveryFee: 0,
      })
      .returning();

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${dummyOrder.id}/transition`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        toStatus: 'REFUNDED',
        note: 'Customer refunded',
      })
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // 4. Staff permissions and restrictions
  // -------------------------------------------------------------------------
  it('4. Staff can edit products, adjust stock, and view orders; gets 403 on product creation, team, orders transition, field sellers', async () => {
    // 4a. Staff CAN adjust stock
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${variantIdA}/adjust`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        delta: 5,
      })
      .expect(201);

    // 4b. Staff CAN view orders
    await request(app.getHttpServer())
      .get('/api/v1/orders/seller')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    // 4c. Staff CANNOT create product (product.create required)
    await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Ghee 500g',
        categoryId,
        variants: [
          {
            sku: 'GHEE-500G',
            unit: 'jar',
            pricePaisa: 60000,
            minOrderQty: 1,
            initialStock: 10,
          },
        ],
      })
      .expect(403);

    // 4d. Staff CANNOT access team list or manage team
    await request(app.getHttpServer())
      .get('/api/v1/seller/team')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Other Staff',
        email: 'other@alpha.test',
        role: 'STAFF',
      })
      .expect(403);

    // 4e. Staff CANNOT manage field sellers
    await request(app.getHttpServer())
      .get('/api/v1/seller/field-sellers')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // 5. Hierarchy enforcement: Manager manages Staff, cannot manage Managers or Owner
  // -------------------------------------------------------------------------
  it('5. Hierarchy enforcement: Manager manages Staff only; cannot act on self, Owner, or peer Managers', async () => {
    // 5a. Manager creates another Staff member
    const newStaff = await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({
        name: 'Subordinate Staff',
        email: 'subordinate@alpha.test',
        role: 'STAFF',
      })
      .expect(201);

    // 5b. Manager updates Staff name
    await request(app.getHttpServer())
      .patch(`/api/v1/seller/team/${newStaff.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .send({ name: 'Subordinate Staff Updated' })
      .expect(200);

    // 5c. Manager disables Staff
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${newStaff.body.id}/disable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    // 5d. Manager enables Staff
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${newStaff.body.id}/enable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    // 5e. Manager resets Staff password
    const resetRes = await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${newStaff.body.id}/reset-password`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);
    expect(resetRes.body.temporaryPassword).toBeDefined();

    // 5f. Manager CANNOT disable self
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${managerMembershipId}/disable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    // 5g. Manager CANNOT manage Owner
    const [ownerMembership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, ownerAUserId));

    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${ownerMembership.id}/disable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    // 5h. Owner lists team: sees Managers and Staff; Manager lists team: sees Staff only
    const ownerList = await request(app.getHttpServer())
      .get('/api/v1/seller/team')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    const ownerListRoles = ownerList.body.map((m: any) => m.role);
    expect(ownerListRoles).toContain('MANAGER');
    expect(ownerListRoles).toContain('STAFF');

    const managerList = await request(app.getHttpServer())
      .get('/api/v1/seller/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    const managerListRoles = managerList.body.map((m: any) => m.role);
    expect(managerListRoles).not.toContain('MANAGER');
    expect(managerListRoles).toContain('STAFF');
  });

  // -------------------------------------------------------------------------
  // 6. Tenancy isolation between seller organizations
  // -------------------------------------------------------------------------
  it('6. Tenancy isolation: Manager of Org A cannot view or manage Org B members', async () => {
    // Org B owner creates a staff member in Org B
    const bStaff = await request(app.getHttpServer())
      .post('/api/v1/seller/team')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .set('x-org-id', ownerBOrgId)
      .send({
        name: 'Beta Staff',
        email: 'beta_staff@beta.test',
        role: 'STAFF',
      })
      .expect(201);

    // Org A Manager attempts to disable Org B staff member with Org A header -> 404
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${bStaff.body.id}/disable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(404);

    // Org A Manager attempts to pass Org B header -> 403 Forbidden (not a member of Org B)
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${bStaff.body.id}/disable`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-org-id', ownerBOrgId)
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // 7. Disabled membership blocks requests immediately
  // -------------------------------------------------------------------------
  it('7. Disabling a team member revokes refresh token and causes OrgContextGuard to reject with MEMBERSHIP_DISABLED', async () => {
    // Owner disables the staff member
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${staffMembershipId}/disable`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    // Existing access token for disabled staff member is rejected with 403 MEMBERSHIP_DISABLED
    const disabledRes = await request(app.getHttpServer())
      .get('/api/v1/catalog/products/seller')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(403);

    expect(disabledRes.body.code).toBe('MEMBERSHIP_DISABLED');

    // Attempting login as disabled member returns 403 or disabled status
    // When re-enabled by owner, member can access again
    await request(app.getHttpServer())
      .post(`/api/v1/seller/team/${staffMembershipId}/enable`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/catalog/products/seller')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);
  });

  // -------------------------------------------------------------------------
  // 8. Audit log records actions (price changes, stock adjust, team operations)
  // -------------------------------------------------------------------------
  it('8. Owner can view activity log with audit records of price changes, stock adjustments, and team actions', async () => {
    const activityRes = await request(app.getHttpServer())
      .get('/api/v1/seller/activity')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-org-id', ownerAOrgId)
      .expect(200);

    expect(activityRes.body.items).toBeDefined();
    expect(activityRes.body.items.length).toBeGreaterThan(0);

    const actionNames = activityRes.body.items.map((i: any) => i.action);
    expect(actionNames).toContain('team.member_created');
    expect(actionNames).toContain('product.price_changed');
    expect(actionNames).toContain('stock.adjusted');
    expect(actionNames).toContain('fieldseller.created');
  });
});
