import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  dayPlanStock,
  products,
  retailClients,
  routeClients,
  stockWriteOffs,
  users,
  visits,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Product = typeof products.$inferSelect;
type Client = typeof retailClients.$inferSelect;

const PLANS = '/api/v1/day-plans';

// The day used throughout (base units in brackets):
//   NDL-70 (30 per carton): issued 2 cartons + 10 pieces (70)
//   WTR-1L (12 per carton): issued 1 carton (12)
//   CLA-500:                issued 5 pieces (5)
// Sold: NDL 1 carton + 5 (35), WTR 3 (3). Written off: NDL 2.
// Salesman returns: NDL 1 carton + 3 (33); WTR 0 cartons + 9 loose (9); CLA 5.
// Manager counts:   NDL 1 carton + 1 (31); WTR 0 cartons + 8 loose (8); CLA 5.
//   Shortage on the salesman's figures:  NDL 70-35-33-2 = 0, WTR 12-3-9 = 0
//   Shortage on the manager's count:     NDL 70-35-31-2 = 2, WTR 12-3-8 = 1
// Cash: 20,000 + 7,500 paid with sales, 1,000 collected separately = 28,500
// expected; a pending transfer and an office payment do not count. He hands
// over 28,000: 500 short.

describe('Closing and reconciling (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>;
  let shops: Client[];
  let planId: string;
  const tokens = {} as Record<
    'owner' | 'manager' | 'salesman1' | 'salesman2' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object, headers: Record<string, string> = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).set(headers).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  const key = () => ({ 'Idempotency-Key': `k-${randomUUID()}` });
  const line = (sku: string, unit: string, n: number) => ({
    productId: p[sku].id,
    unit,
    quantity: n,
  });
  const ret = (sku: string, unit: string, n: number) => ({
    productId: p[sku].id,
    unit,
    quantityReturned: n,
  });
  const cnt = (sku: string, unit: string, n: number) => ({
    productId: p[sku].id,
    unit,
    quantityCounted: n,
  });
  const warehouse = async () =>
    Object.fromEntries(
      (
        await db
          .select({ sku: products.sku, q: products.stockQuantity })
          .from(products)
      ).map((r) => [r.sku, r.q]),
    );
  const statusOf = async () =>
    (await db.select().from(dayPlans).where(eq(dayPlans.id, planId)))[0];
  const finishVisits = async () => {
    const stops = await db
      .select()
      .from(visits)
      .where(eq(visits.dayPlanId, planId))
      .orderBy(asc(visits.sequence));
    for (const [i, v] of stops.entries()) {
      await as(tokens.salesman1)
        .patch(`/api/v1/visits/${v.id}`, {
          status: i === stops.length - 1 ? 'skipped' : 'visited',
        })
        .expect(200);
    }
  };
  const closeBody = () => ({
    cashHandedOverPaisa: 28_000,
    returned: [
      ret('NDL-70', 'carton', 1),
      ret('NDL-70', 'base', 3),
      ret('WTR-1L', 'carton', 0),
      ret('WTR-1L', 'base', 9), // loose pieces from the opened carton
      ret('CLA-500', 'base', 5),
    ],
  });
  const close = (token = tokens.salesman1, body: object = closeBody()) =>
    as(token).post(`${PLANS}/${planId}/close`, body);
  const reconcileBody = () => ({
    counted: [
      cnt('NDL-70', 'carton', 1),
      cnt('NDL-70', 'base', 1),
      cnt('WTR-1L', 'carton', 0),
      cnt('WTR-1L', 'base', 8),
      cnt('CLA-500', 'base', 5),
    ],
    note: 'Two noodles and a bottle missing',
  });
  const reconcile = (token = tokens.manager, body: object = reconcileBody()) =>
    as(token).post(`${PLANS}/${planId}/reconcile`, body);
  const report = async (token = tokens.manager) =>
    (await as(token).get(`${PLANS}/${planId}/report`).expect(200)).body;
  const bySku = (r: {
    products: { product: { sku: string } }[];
  }): Record<string, Record<string, unknown>> =>
    Object.fromEntries(r.products.map((x) => [x.product.sku, x]));

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  beforeEach(async () => {
    await truncateAll(db);
    seeded = await seed(db);
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.businessId, seeded.businessId));
    const byEmail = (e: string) => rows.find((u) => u.email === e)!;
    staff = {
      owner: byEmail('owner@asva.test'),
      manager: byEmail('manager@asva.test'),
      salesman1: byEmail('salesman1@asva.test'),
      salesman2: byEmail('salesman2@asva.test'),
    };
    for (const k of Object.keys(staff) as (keyof typeof staff)[]) {
      tokens[k] = await staffToken(app, staff[k]);
    }
    p = Object.fromEntries(
      (await db.select().from(products)).map((r) => [r.sku, r]),
    );
    shops = (
      await db
        .select({ c: retailClients })
        .from(retailClients)
        .innerJoin(routeClients, eq(routeClients.clientId, retailClients.id))
        .orderBy(routeClients.sequence)
    ).map((r) => r.c);
    const b = await insertBusiness(db);
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, b.id, { role: 'owner' }),
    );

    // The day described at the top.
    planId = (
      await as(tokens.manager)
        .post(PLANS, {
          salesmanId: staff.salesman1.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock: [
            line('NDL-70', 'carton', 2),
            line('NDL-70', 'base', 10),
            line('WTR-1L', 'carton', 1),
            line('CLA-500', 'base', 5),
          ],
        })
        .expect(201)
    ).body.id;
    await as(tokens.salesman1).post(`${PLANS}/${planId}/start`, {}).expect(200);
    await as(tokens.salesman1)
      .post(
        '/api/v1/sales',
        {
          clientId: shops[0].id,
          items: [line('NDL-70', 'carton', 1), line('NDL-70', 'base', 5)],
          cashPaidNowPaisa: 20_000,
        },
        key(),
      )
      .expect(201);
    await as(tokens.salesman1)
      .post(
        '/api/v1/sales',
        {
          clientId: shops[1].id,
          items: [line('WTR-1L', 'base', 3)],
          cashPaidNowPaisa: 7500,
        },
        key(),
      )
      .expect(201);
    await as(tokens.salesman1)
      .post(
        '/api/v1/payments',
        { clientId: shops[2].id, method: 'cash', amountPaisa: 1000 },
        key(),
      )
      .expect(201);
    const screenshot = await sharp(randomBytes(16 * 16 * 3), {
      raw: { width: 16, height: 16, channels: 3 },
    })
      .jpeg()
      .toBuffer();
    await http()
      .post('/api/v1/payments')
      .auth(tokens.salesman1, { type: 'bearer' })
      .set(key())
      .field('clientId', shops[2].id)
      .field('method', 'online')
      .field('amountPaisa', '5000')
      .attach('online_screenshot', screenshot, {
        filename: 's.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    await as(tokens.manager)
      .post(
        '/api/v1/payments',
        { clientId: shops[2].id, method: 'cash', amountPaisa: 3000 },
        key(),
      )
      .expect(201); // at the office: no plan
    await db.insert(stockWriteOffs).values({
      id: randomUUID(),
      businessId: seeded.businessId,
      productId: p['NDL-70'].id,
      unit: 'base',
      quantity: 2,
      reason: 'damaged',
      writeOffDate: nepalToday(),
      dayPlanId: planId,
      recordedBy: staff.manager.id,
      createdAt: new Date(),
    });
  });
  afterAll(() => app.close());

  describe('closing the day', () => {
    it('records returns and cash, and closes the plan', async () => {
      await finishVisits();
      const res = await close().expect(200);
      expect(res.body.status).toBe('closed');
      const plan = await statusOf();
      expect(plan).toMatchObject({
        status: 'closed',
        cashHandedOverPaisa: 28_000,
      });
      expect(plan.closedAt).toBeInstanceOf(Date);

      const lines = await db
        .select()
        .from(dayPlanStock)
        .where(eq(dayPlanStock.dayPlanId, planId));
      const looseWater = lines.find(
        (l) => l.productId === p['WTR-1L'].id && l.unit === 'base',
      );
      // The loose pieces became a line of their own, with nothing issued.
      expect(looseWater).toMatchObject({
        quantityIssued: 0,
        quantityReturned: 9,
      });
      expect(lines).toHaveLength(5);
    });

    it('rejects closing while any visit is still planned', async () => {
      const res = await close().expect(409);
      expect(res.body.error.code).toBe('VISITS_PENDING');
      expect(res.body.error.details).toHaveLength(3);
      expect((await statusOf()).status).toBe('in_progress');
    });

    it.each([
      [
        'a missing stock line',
        (b: ReturnType<typeof closeBody>) => b.returned.slice(1),
      ],
      [
        'a repeated stock line',
        (b: ReturnType<typeof closeBody>) => [...b.returned, b.returned[0]],
      ],
      [
        'a product not on the plan',
        (b: ReturnType<typeof closeBody>) => [
          ...b.returned,
          ret('BSC-100', 'base', 1),
        ],
      ],
    ])('rejects %s', async (_label, edit) => {
      await finishVisits();
      const body = closeBody();
      const res = await close(tokens.salesman1, {
        ...body,
        returned: edit(body),
      }).expect(400);
      expect(res.body.error.code).toBe('STOCK_LINES_MISMATCH');
      expect((await statusOf()).status).toBe('in_progress');
      const lines = await db
        .select()
        .from(dayPlanStock)
        .where(eq(dayPlanStock.dayPlanId, planId));
      expect(lines).toHaveLength(4); // nothing written
    });

    it('only the plan’s own salesman closes it, and only while in progress', async () => {
      await finishVisits();
      await close(tokens.salesman2).expect(404);
      await close(tokens.manager).expect(403);
      await close().expect(200);
      const again = await close().expect(409);
      expect(again.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
    });

    it('stops sales and payments on the plan once closed', async () => {
      await finishVisits();
      await close().expect(200);
      const sale = await as(tokens.salesman1)
        .post(
          '/api/v1/sales',
          {
            clientId: shops[0].id,
            dayPlanId: planId,
            items: [line('CLA-500', 'base', 1)],
          },
          key(),
        )
        .expect(409);
      expect(sale.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
      await as(tokens.salesman1)
        .post(
          '/api/v1/payments',
          { clientId: shops[0].id, method: 'cash', amountPaisa: 100 },
          key(),
        )
        .expect(409);
    });
  });

  describe('reconciling', () => {
    beforeEach(async () => {
      await finishVisits();
      await close().expect(200);
    });

    it('saves the counts, reconciles, and adds counted stock back (cartons converted)', async () => {
      const before = await warehouse();
      expect(before).toMatchObject({
        'NDL-70': 3000 - 70,
        'WTR-1L': 1200 - 12,
        'CLA-500': 960 - 5,
      });

      const res = await reconcile().expect(200);
      expect(res.body.status).toBe('reconciled');
      expect(await warehouse()).toEqual({
        ...before,
        'NDL-70': before['NDL-70'] + 30 + 1,
        'WTR-1L': before['WTR-1L'] + 0 + 8,
        'CLA-500': before['CLA-500'] + 5,
      });

      const plan = await statusOf();
      expect(plan).toMatchObject({
        status: 'reconciled',
        reconciledBy: staff.manager.id,
      });
      expect(plan.reconciledAt).toBeInstanceOf(Date);
      expect(plan.note).toBe(
        'Reconciliation: Two noodles and a bottle missing',
      );
      const lines = await db
        .select()
        .from(dayPlanStock)
        .where(eq(dayPlanStock.dayPlanId, planId));
      expect(lines.every((l) => l.quantityCounted !== null)).toBe(true);
    });

    it('a plan cannot be reconciled twice', async () => {
      await reconcile().expect(200);
      const after = await warehouse();
      const res = await reconcile(tokens.owner).expect(409);
      expect(res.body.error.code).toBe('ALREADY_RECONCILED');
      expect(await warehouse()).toEqual(after);
    });

    it('two reconciliations at once still add stock only once', async () => {
      const before = await warehouse();
      const results = await Promise.all([reconcile(), reconcile(tokens.owner)]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      expect((await warehouse())['NDL-70']).toBe(before['NDL-70'] + 31);
    });

    it('a salesman cannot reconcile', async () => {
      await reconcile(tokens.salesman1).expect(403);
      expect((await statusOf()).status).toBe('closed');
    });

    it('needs every line counted, and changes nothing otherwise', async () => {
      const before = await warehouse();
      const body = reconcileBody();
      const res = await reconcile(tokens.manager, {
        ...body,
        counted: body.counted.slice(0, 2),
      }).expect(400);
      expect(res.body.error.code).toBe('STOCK_LINES_MISMATCH');
      expect(await warehouse()).toEqual(before);
      expect((await statusOf()).status).toBe('closed');
    });

    it('only reconciles a closed plan of its own business', async () => {
      await reconcile(tokens.bOwner).expect(404);
      await db
        .update(dayPlans)
        .set({ status: 'in_progress' })
        .where(eq(dayPlans.id, planId));
      const res = await reconcile().expect(409);
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_CLOSED');
    });
  });

  describe('report', () => {
    it('before closing: issued, sold and written off, but no returns or shortage', async () => {
      const r = await report();
      expect(r.status).toBe('in_progress');
      expect(bySku(r)['NDL-70']).toMatchObject({
        issued: 70,
        sold: 35,
        returned: null,
        counted: null,
        writtenOff: 2,
        shortage: null,
      });
      expect(r.cash).toEqual({
        expectedPaisa: 28_500,
        handedOverPaisa: null,
        differencePaisa: null,
      });
    });

    it('the shortage uses the manager’s count when present, else the salesman’s figure', async () => {
      await finishVisits();
      await close().expect(200);

      const closed = bySku(await report());
      expect(closed['NDL-70']).toMatchObject({
        issued: 70,
        sold: 35,
        returned: 33,
        counted: null,
        writtenOff: 2,
        shortage: 0,
      });
      expect(closed['WTR-1L']).toMatchObject({
        issued: 12,
        sold: 3,
        returned: 9,
        shortage: 0,
      });

      await reconcile().expect(200);
      const reconciled = bySku(await report());
      expect(reconciled['NDL-70']).toMatchObject({
        returned: 33,
        counted: 31,
        shortage: 2,
      });
      expect(reconciled['WTR-1L']).toMatchObject({
        returned: 9,
        counted: 8,
        shortage: 1,
      });
      expect(reconciled['CLA-500']).toMatchObject({
        issued: 5,
        sold: 0,
        returned: 5,
        counted: 5,
        shortage: 0,
      });
    });

    it('the cash difference is correct', async () => {
      // A confirmed transfer is still not cash in hand.
      const [online] = (
        await as(tokens.manager).get('/api/v1/payments?method=online')
      ).body.data;
      await as(tokens.manager)
        .patch(`/api/v1/payments/${online.id}/status`, { status: 'confirmed' })
        .expect(200);
      await finishVisits();
      await close().expect(200);
      expect((await report()).cash).toEqual({
        expectedPaisa: 28_500,
        handedOverPaisa: 28_000,
        differencePaisa: -500,
      });
    });

    it('a cancelled sale no longer counts as sold', async () => {
      const fresh = (
        await as(tokens.salesman1)
          .post(
            '/api/v1/sales',
            { clientId: shops[1].id, items: [line('CLA-500', 'base', 2)] },
            key(),
          )
          .expect(201)
      ).body;
      expect(bySku(await report())['CLA-500'].sold).toBe(2);
      await as(tokens.manager)
        .post(`/api/v1/sales/${fresh.id}/cancel`, { reason: 'x' })
        .expect(200);
      expect(bySku(await report())['CLA-500'].sold).toBe(0);
    });

    it('is visible to the plan’s salesman and managers only', async () => {
      await report(tokens.salesman1);
      await as(tokens.salesman2).get(`${PLANS}/${planId}/report`).expect(404);
      await as(tokens.bOwner).get(`${PLANS}/${planId}/report`).expect(404);
    });
  });
});
