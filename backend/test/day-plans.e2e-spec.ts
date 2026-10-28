import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { asc, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  dayPlanStock,
  products,
  retailClients,
  routeClients,
  routes,
  users,
  visits,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { staffToken } from './utils/auth.js';
import {
  insertBusiness,
  insertProduct,
  insertUser,
} from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Product = typeof products.$inferSelect;

const PLANS = '/api/v1/day-plans';

/** YYYY-MM-DD, `days` after today in Nepal. */
function nepalDate(days: number): string {
  const d = new Date(`${nepalToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Day plans (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>; // seeded products by SKU
  let shopIds: string[]; // seeded route order
  const tokens = {} as Record<
    'owner' | 'manager' | 'salesman1' | 'salesman2' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    delete: (url: string) => http().delete(url).auth(token, { type: 'bearer' }),
  });
  const stockOf = async () =>
    Object.fromEntries(
      (
        await db
          .select({ sku: products.sku, q: products.stockQuantity })
          .from(products)
      ).map((r) => [r.sku, r.q]),
    );
  const planBody = (overrides: object = {}) => ({
    salesmanId: staff.salesman1.id,
    routeId: seeded.routeId,
    planDate: nepalDate(1),
    stock: [],
    ...overrides,
  });
  const createPlan = (overrides: object = {}) =>
    as(tokens.manager).post(PLANS, planBody(overrides));
  const rowCounts = async () => ({
    plans: (await db.select().from(dayPlans)).length,
    lines: (await db.select().from(dayPlanStock)).length,
    visits: (await db.select().from(visits)).length,
  });

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
    shopIds = (
      await db
        .select({ id: routeClients.clientId })
        .from(routeClients)
        .where(eq(routeClients.routeId, seeded.routeId))
        .orderBy(asc(routeClients.sequence))
    ).map((r) => r.id);

    const bBusiness = await insertBusiness(db);
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, bBusiness.id, { role: 'owner' }),
    );
  });
  afterAll(() => app.close());

  describe('creating a plan', () => {
    it('reduces stock by the right base units, carton lines included', async () => {
      // NDL-70: 30 per carton, 3000 in stock. WTR-1L: 12 per carton, 1200.
      const res = await createPlan({
        stock: [
          { productId: p['NDL-70'].id, unit: 'base', quantity: 10 },
          { productId: p['NDL-70'].id, unit: 'carton', quantity: 2 },
          { productId: p['WTR-1L'].id, unit: 'carton', quantity: 5 },
        ],
        note: 'Festival week',
      }).expect(201);

      expect(await stockOf()).toMatchObject({
        'NDL-70': 3000 - 10 - 2 * 30,
        'WTR-1L': 1200 - 5 * 12,
        'BSC-100': 4800,
        'CLA-500': 960,
      });
      expect(res.body).toMatchObject({
        status: 'planned',
        planDate: nepalDate(1),
        note: 'Festival week',
        assignedBy: staff.manager.id,
        salesman: { id: staff.salesman1.id, fullName: 'Suman Gurung' },
        route: { id: seeded.routeId },
      });
      expect(
        res.body.stock.map(
          (l: {
            product: { sku: string };
            unit: string;
            quantityIssued: number;
          }) => [l.product.sku, l.unit, l.quantityIssued],
        ),
      ).toEqual([
        ['NDL-70', 'base', 10],
        ['NDL-70', 'carton', 2],
        ['WTR-1L', 'carton', 5],
      ]);
      expect(res.text).not.toMatch(/costPrice/i);
    });

    it('rejects insufficient stock, listing every shortage, and changes nothing', async () => {
      const before = await stockOf();
      const res = await createPlan({
        stock: [
          { productId: p['NDL-70'].id, unit: 'base', quantity: 5 }, // fine
          { productId: p['CLA-500'].id, unit: 'carton', quantity: 41 }, // 984 > 960
          { productId: p['WTR-1L'].id, unit: 'base', quantity: 1000 },
          { productId: p['WTR-1L'].id, unit: 'carton', quantity: 20 }, // 1240 > 1200
        ],
      }).expect(409);

      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
      expect(res.body.error.message).toContain(
        'Cola 500ml (need 984, have 960)',
      );
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: p['CLA-500'].id,
            requested: 984,
            available: 960,
          }),
          expect.objectContaining({
            productId: p['WTR-1L'].id,
            requested: 1240,
            available: 1200,
          }),
        ]),
      );
      expect(res.body.error.details).toHaveLength(2);
      expect(await stockOf()).toEqual(before);
      expect(await rowCounts()).toEqual({ plans: 0, lines: 0, visits: 0 });
    });

    it('allows issuing exactly all the stock there is', async () => {
      await createPlan({
        stock: [{ productId: p['CLA-500'].id, unit: 'carton', quantity: 40 }],
      }).expect(201);
      expect((await stockOf())['CLA-500']).toBe(0);
    });

    it('creates one visit per shop, in route order', async () => {
      const order = [shopIds[2], shopIds[0], shopIds[1]];
      await http()
        .put(`/api/v1/routes/${seeded.routeId}/clients`)
        .auth(tokens.manager, { type: 'bearer' })
        .send({ clientIds: order })
        .expect(200);

      const res = await createPlan().expect(201);
      expect(
        res.body.visits.map((v: { client: { id: string } }) => v.client.id),
      ).toEqual(order);
      expect(
        res.body.visits.map((v: { sequence: number; status: string }) => [
          v.sequence,
          v.status,
        ]),
      ).toEqual([
        [0, 'planned'],
        [1, 'planned'],
        [2, 'planned'],
      ]);
      const stored = await db
        .select({ clientId: visits.clientId, sequence: visits.sequence })
        .from(visits)
        .where(eq(visits.dayPlanId, res.body.id))
        .orderBy(asc(visits.sequence));
      expect(stored.map((v) => v.clientId)).toEqual(order);
    });

    it('skips deactivated shops, keeping the others in order', async () => {
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.id, shopIds[1]));
      const res = await createPlan().expect(201);
      expect(
        res.body.visits.map((v: { client: { id: string } }) => v.client.id),
      ).toEqual([shopIds[0], shopIds[2]]);
      expect(
        res.body.visits.map((v: { sequence: number }) => v.sequence),
      ).toEqual([0, 1]);
    });

    it('returns 409 for the same salesman, route and date, and takes stock once', async () => {
      const stock = [
        { productId: p['BSC-100'].id, unit: 'base', quantity: 100 },
      ];
      await createPlan({ stock }).expect(201);
      const res = await createPlan({ stock }).expect(409);
      expect(res.body.error.code).toBe('DAY_PLAN_EXISTS');
      expect((await stockOf())['BSC-100']).toBe(4700);
      // A different date or salesman is a different plan.
      await createPlan({ stock, planDate: nepalDate(2) }).expect(201);
      await createPlan({ stock, salesmanId: staff.salesman2.id }).expect(201);
    });

    it('cannot over-issue under concurrent plans', async () => {
      const stock = [
        { productId: p['CLA-500'].id, unit: 'base', quantity: 600 },
      ];
      const results = await Promise.all([
        createPlan({ stock }),
        createPlan({ stock, salesmanId: staff.salesman2.id }),
      ]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 409,
      ]);
      expect((await stockOf())['CLA-500']).toBe(360);
      expect((await rowCounts()).plans).toBe(1);
    });

    it.each([
      ['the manager', () => staff.manager.id],
      ['the owner', () => staff.owner.id],
      ['an unknown id', () => randomUUID()],
    ])('rejects %s as salesman', async (_label, id) => {
      const res = await createPlan({ salesmanId: id() }).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'INVALID_SALESMAN',
        message: 'salesmanId must be an active salesman in this business',
      });
    });

    it('rejects an inactive salesman', async () => {
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, staff.salesman2.id));
      const res = await createPlan({ salesmanId: staff.salesman2.id }).expect(
        422,
      );
      expect(res.body.error.code).toBe('INVALID_SALESMAN');
    });

    it('rejects a deactivated route', async () => {
      await db
        .update(routes)
        .set({ isActive: false })
        .where(eq(routes.id, seeded.routeId));
      const res = await createPlan().expect(409);
      expect(res.body.error.code).toBe('ROUTE_INACTIVE');
    });

    it('rejects unusable products, changing nothing', async () => {
      const before = await stockOf();
      await db
        .update(products)
        .set({ isActive: false })
        .where(eq(products.id, p['CHP-50'].id));
      const noCarton = await insertProduct(db, seeded.businessId, {
        sku: 'LOOSE',
        stockQuantity: 100,
      });
      const cases: [object, number, string][] = [
        [
          { productId: p['CHP-50'].id, unit: 'base', quantity: 1 },
          409,
          'PRODUCT_INACTIVE',
        ],
        [
          { productId: randomUUID(), unit: 'base', quantity: 1 },
          404,
          'PRODUCT_NOT_FOUND',
        ],
        [
          { productId: noCarton.id, unit: 'carton', quantity: 1 },
          422,
          'NO_CARTON_SIZE',
        ],
      ];
      for (const [line, status, code] of cases) {
        const res = await createPlan({
          stock: [
            { productId: p['NDL-70'].id, unit: 'base', quantity: 1 },
            line,
          ],
        });
        expect([res.status, res.body.error.code]).toEqual([status, code]);
      }
      expect(await stockOf()).toMatchObject({ ...before, 'CHP-50': 2000 });
      expect(await rowCounts()).toEqual({ plans: 0, lines: 0, visits: 0 });
    });

    it.each([
      ['a past date', { planDate: nepalDate(-1) }, 'PLAN_DATE_IN_PAST'],
      ['an impossible date', { planDate: '2026-02-30' }, 'VALIDATION_FAILED'],
      [
        'a zero quantity',
        { stock: [{ productId: randomUUID(), unit: 'base', quantity: 0 }] },
        'VALIDATION_FAILED',
      ],
      [
        'an unknown unit',
        { stock: [{ productId: randomUUID(), unit: 'box', quantity: 1 }] },
        'VALIDATION_FAILED',
      ],
      ['a missing route', { routeId: undefined }, 'VALIDATION_FAILED'],
    ])('rejects %s', async (_label, overrides, code) => {
      const res = await createPlan(overrides).expect(400);
      expect(res.body.error.code).toBe(code);
    });

    it('rejects the same product and unit twice', async () => {
      const line = { productId: p['NDL-70'].id, unit: 'base', quantity: 1 };
      const res = await createPlan({ stock: [line, line] }).expect(400);
      expect(res.body.error.code).toBe('DUPLICATE_STOCK_LINE');
    });

    it('accepts today and a plan with no stock', async () => {
      const res = await createPlan({ planDate: nepalToday() }).expect(201);
      expect(res.body.stock).toEqual([]);
    });

    it('salesmen cannot create plans', async () => {
      await as(tokens.salesman1).post(PLANS, planBody()).expect(403);
    });
  });

  describe('reading plans', () => {
    let plan1: string; // salesman1, tomorrow
    let plan2: string; // salesman2, day after

    beforeEach(async () => {
      plan1 = (await createPlan()).body.id;
      plan2 = (
        await createPlan({
          salesmanId: staff.salesman2.id,
          planDate: nepalDate(2),
        })
      ).body.id;
    });

    it('a salesman cannot see another salesman’s plan', async () => {
      const res = await as(tokens.salesman1)
        .get(`${PLANS}/${plan2}`)
        .expect(404);
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_FOUND');
      expect(res.text).not.toContain('Nabin');

      const list = await as(tokens.salesman1).get(PLANS).expect(200);
      expect(list.body.data.map((d: { id: string }) => d.id)).toEqual([plan1]);
      // Asking for the other salesman's plans does not widen the view.
      const asked = await as(tokens.salesman1)
        .get(`${PLANS}?salesmanId=${staff.salesman2.id}`)
        .expect(200);
      expect(asked.body.data.map((d: { id: string }) => d.id)).toEqual([plan1]);
    });

    it('a salesman reads his own plan with stock lines and visits', async () => {
      const res = await as(tokens.salesman1)
        .get(`${PLANS}/${plan1}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: plan1, status: 'planned' });
      expect(res.body.visits).toHaveLength(3);
      expect(res.body.stock).toEqual([]);
    });

    it('managers see all plans and can filter by date, salesman and status', async () => {
      const all = await as(tokens.manager).get(PLANS).expect(200);
      expect(all.body.total).toBe(2);
      // Newest date first.
      expect(all.body.data.map((d: { id: string }) => d.id)).toEqual([
        plan2,
        plan1,
      ]);

      const byDate = await as(tokens.manager).get(
        `${PLANS}?date=${nepalDate(1)}`,
      );
      expect(byDate.body.data.map((d: { id: string }) => d.id)).toEqual([
        plan1,
      ]);
      const bySalesman = await as(tokens.manager).get(
        `${PLANS}?salesmanId=${staff.salesman2.id}`,
      );
      expect(bySalesman.body.data.map((d: { id: string }) => d.id)).toEqual([
        plan2,
      ]);

      await db
        .update(dayPlans)
        .set({ status: 'in_progress' })
        .where(eq(dayPlans.id, plan2));
      const byStatus = await as(tokens.manager).get(
        `${PLANS}?status=in_progress`,
      );
      expect(byStatus.body.data.map((d: { id: string }) => d.id)).toEqual([
        plan2,
      ]);
      await as(tokens.manager).get(`${PLANS}?status=done`).expect(400);
    });

    it('another business sees none of them', async () => {
      const list = await as(tokens.bOwner).get(PLANS).expect(200);
      expect(list.body.total).toBe(0);
      await as(tokens.bOwner).get(`${PLANS}/${plan1}`).expect(404);
      await as(tokens.bOwner).delete(`${PLANS}/${plan1}`).expect(404);
      expect((await rowCounts()).plans).toBe(2);
    });
  });

  describe('deleting a plan', () => {
    const issue = () => [
      { productId: p['NDL-70'].id, unit: 'carton', quantity: 3 },
      { productId: p['NDL-70'].id, unit: 'base', quantity: 7 },
      { productId: p['CHP-50'].id, unit: 'carton', quantity: 2 },
    ];

    it('deleting a planned plan restores the stock and removes its rows', async () => {
      const before = await stockOf();
      const plan = (await createPlan({ stock: issue() }).expect(201)).body;
      expect(await stockOf()).toMatchObject({
        'NDL-70': 3000 - 97,
        'CHP-50': 2000 - 80,
      });

      await as(tokens.manager).delete(`${PLANS}/${plan.id}`).expect(204);
      expect(await stockOf()).toEqual(before);
      expect(await rowCounts()).toEqual({ plans: 0, lines: 0, visits: 0 });
      // The slot is free again.
      await createPlan().expect(201);
    });

    it('restores stock even if a product was deactivated meanwhile', async () => {
      const plan = (await createPlan({ stock: issue() })).body;
      await db
        .update(products)
        .set({ isActive: false })
        .where(eq(products.id, p['CHP-50'].id));
      await as(tokens.owner).delete(`${PLANS}/${plan.id}`).expect(204);
      expect((await stockOf())['CHP-50']).toBe(2000);
    });

    it.each(['in_progress', 'closed', 'reconciled'] as const)(
      'rejects deleting a plan that is %s, changing nothing',
      async (status) => {
        const plan = (await createPlan({ stock: issue() })).body;
        await db
          .update(dayPlans)
          .set({ status })
          .where(eq(dayPlans.id, plan.id));
        const before = await stockOf();

        const res = await as(tokens.manager)
          .delete(`${PLANS}/${plan.id}`)
          .expect(409);
        expect(res.body.error).toMatchObject({
          code: 'DAY_PLAN_NOT_DELETABLE',
          message: `Only a planned day plan can be deleted; this one is ${status}`,
        });
        expect(await stockOf()).toEqual(before);
        expect(await rowCounts()).toEqual({ plans: 1, lines: 3, visits: 3 });
      },
    );

    it('salesmen cannot delete plans', async () => {
      const plan = (await createPlan()).body;
      await as(tokens.salesman1).delete(`${PLANS}/${plan.id}`).expect(403);
    });
  });

  it('does not touch other businesses’ products', async () => {
    const bProduct = await insertProduct(db, (await insertBusiness(db)).id, {
      stockQuantity: 100,
    });
    const res = await createPlan({
      stock: [{ productId: bProduct.id, unit: 'base', quantity: 10 }],
    }).expect(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    const [row] = await db
      .select()
      .from(products)
      .where(inArray(products.id, [bProduct.id]));
    expect(row.stockQuantity).toBe(100);
  });
});
