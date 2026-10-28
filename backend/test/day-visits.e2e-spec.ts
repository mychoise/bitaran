import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  retailClients,
  routeClients,
  routes,
  users,
  visits,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { staffToken } from './utils/auth.js';
import { insertBusiness } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Visit = typeof visits.$inferSelect;
type PlanStatus = (typeof dayPlans.$inferSelect)['status'];

const PLANS = '/api/v1/day-plans';
const VISITS = '/api/v1/visits';

function nepalDate(days: number): string {
  const d = new Date(`${nepalToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Starting the day and visits (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'manager' | 'salesman1' | 'salesman2', User>;
  let shopIds: string[];
  let secondRouteId: string;
  // salesman1 has two plans today (A on the seeded route, B on a second
  // route); salesman2 has one (C).
  let plan: Record<'a' | 'b' | 'c', string>;
  const tokens = {} as Record<'manager' | 'salesman1' | 'salesman2', string>;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  const statusOf = async (id: string) =>
    (await db.select().from(dayPlans).where(eq(dayPlans.id, id)))[0].status;
  const visitsOf = (planId: string) =>
    db
      .select()
      .from(visits)
      .where(eq(visits.dayPlanId, planId))
      .orderBy(asc(visits.sequence));
  const start = (token: string, id: string) =>
    as(token).post(`${PLANS}/${id}/start`);
  const makePlan = async (body: object) =>
    (
      await as(tokens.manager)
        .post(PLANS, { planDate: nepalToday(), stock: [], ...body })
        .expect(201)
    ).body.id as string;
  const setStatus = (id: string, status: PlanStatus) =>
    db.update(dayPlans).set({ status }).where(eq(dayPlans.id, id));

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
      manager: byEmail('manager@asva.test'),
      salesman1: byEmail('salesman1@asva.test'),
      salesman2: byEmail('salesman2@asva.test'),
    };
    for (const k of Object.keys(staff) as (keyof typeof staff)[]) {
      tokens[k] = await staffToken(app, staff[k]);
    }
    shopIds = (
      await db
        .select({ id: routeClients.clientId })
        .from(routeClients)
        .where(eq(routeClients.routeId, seeded.routeId))
        .orderBy(asc(routeClients.sequence))
    ).map((r) => r.id);

    secondRouteId = randomUUID();
    await db.insert(routes).values({
      id: secondRouteId,
      businessId: seeded.businessId,
      name: 'Second route',
      createdAt: new Date(),
    });
    await db
      .insert(routeClients)
      .values({ routeId: secondRouteId, clientId: shopIds[0], sequence: 0 });

    plan = {
      a: await makePlan({
        salesmanId: staff.salesman1.id,
        routeId: seeded.routeId,
      }),
      b: await makePlan({
        salesmanId: staff.salesman1.id,
        routeId: secondRouteId,
      }),
      c: await makePlan({
        salesmanId: staff.salesman2.id,
        routeId: seeded.routeId,
      }),
    };
  });
  afterAll(() => app.close());

  describe('GET /day-plans/today', () => {
    it("returns only the salesman's own plans for today, in full", async () => {
      await makePlan({
        salesmanId: staff.salesman1.id,
        routeId: seeded.routeId,
        planDate: nepalDate(1),
      });
      const res = await as(tokens.salesman1).get(`${PLANS}/today`).expect(200);
      // Ordered by route name: "Kalimati - Balkhu" before "Second route".
      expect(res.body.map((p: { id: string }) => p.id)).toEqual([
        plan.a,
        plan.b,
      ]);
      expect(res.body[0]).toMatchObject({
        planDate: nepalToday(),
        status: 'planned',
        stock: [],
      });
      expect(res.body[0].visits).toHaveLength(3);

      const other = await as(tokens.salesman2).get(`${PLANS}/today`);
      expect(other.body.map((p: { id: string }) => p.id)).toEqual([plan.c]);
    });

    it('is for salesmen', async () => {
      await as(tokens.manager).get(`${PLANS}/today`).expect(403);
    });
  });

  describe('POST /day-plans/:id/start', () => {
    it('starts the salesman’s own plan', async () => {
      const before = Date.now();
      const res = await start(tokens.salesman1, plan.a).expect(200);
      expect(res.body).toMatchObject({ id: plan.a, status: 'in_progress' });
      const startedAt = new Date(res.body.startedAt).getTime();
      expect(startedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(startedAt).toBeLessThanOrEqual(Date.now() + 1000);
      expect(await statusOf(plan.a)).toBe('in_progress');
    });

    it('a salesman cannot start someone else’s plan', async () => {
      const res = await start(tokens.salesman1, plan.c).expect(404);
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_FOUND');
      expect(await statusOf(plan.c)).toBe('planned');
      // Nor can a manager start it on his behalf.
      await start(tokens.manager, plan.c).expect(403);
      expect(await statusOf(plan.c)).toBe('planned');
    });

    it('cannot start a second plan while one is running', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const res = await start(tokens.salesman1, plan.b).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'ANOTHER_PLAN_IN_PROGRESS',
        details: [{ dayPlanId: plan.a, planDate: nepalToday() }],
      });
      expect(await statusOf(plan.b)).toBe('planned');
      // Another salesman's running day does not block this one.
      await start(tokens.salesman2, plan.c).expect(200);
    });

    it('cannot start two plans at the same moment either', async () => {
      const results = await Promise.all([
        start(tokens.salesman1, plan.a),
        start(tokens.salesman1, plan.b),
      ]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        200, 409,
      ]);
      const running = await db
        .select()
        .from(dayPlans)
        .where(
          and(
            eq(dayPlans.salesmanId, staff.salesman1.id),
            eq(dayPlans.status, 'in_progress'),
          ),
        );
      expect(running).toHaveLength(1);
    });

    it('a day left running from yesterday blocks starting today', async () => {
      const stale = await makePlan({
        salesmanId: staff.salesman1.id,
        routeId: seeded.routeId,
        planDate: nepalDate(1),
      });
      await db
        .update(dayPlans)
        .set({ status: 'in_progress', planDate: nepalDate(-1) })
        .where(eq(dayPlans.id, stale));
      const res = await start(tokens.salesman1, plan.a).expect(409);
      expect(res.body.error.details).toEqual([
        { dayPlanId: stale, planDate: nepalDate(-1) },
      ]);
    });

    it('can start the next plan once the running one is closed', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      await setStatus(plan.a, 'closed');
      await start(tokens.salesman1, plan.b).expect(200);
    });

    it('starts only a planned plan, and only on its date', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const again = await start(tokens.salesman1, plan.a).expect(409);
      expect(again.body.error.code).toBe('DAY_PLAN_NOT_STARTABLE');

      const tomorrow = await makePlan({
        salesmanId: staff.salesman2.id,
        routeId: secondRouteId,
        planDate: nepalDate(1),
      });
      const early = await start(tokens.salesman2, tomorrow).expect(409);
      expect(early.body.error).toMatchObject({
        code: 'DAY_PLAN_NOT_TODAY',
        message: `This plan is for ${nepalDate(1)}; only today's plans can be started`,
      });
      expect(await statusOf(tomorrow)).toBe('planned');
    });
  });

  describe('PATCH /visits/:id', () => {
    let stops: Visit[];
    beforeEach(async () => {
      stops = await visitsOf(plan.a);
    });

    it.each(['planned', 'closed', 'reconciled'] as const)(
      'cannot edit visits on a plan that is %s',
      async (status) => {
        await setStatus(plan.a, status);
        const res = await as(tokens.salesman1)
          .patch(`${VISITS}/${stops[0].id}`, { status: 'visited' })
          .expect(409);
        expect(res.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
        expect((await visitsOf(plan.a))[0]).toMatchObject({
          status: 'planned',
          visitedAt: null,
        });
      },
    );

    it('marks a visit visited with the server time and location', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const before = Date.now();
      const res = await as(tokens.salesman1)
        .patch(`${VISITS}/${stops[0].id}`, {
          status: 'visited',
          note: 'Owner away, spoke to son',
          lat: 27.6985,
          lng: 85.2961,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        id: stops[0].id,
        dayPlanId: plan.a,
        status: 'visited',
        note: 'Owner away, spoke to son',
        lat: 27.6985,
        lng: 85.2961,
        client: { id: shopIds[0] },
      });
      const visitedAt = new Date(res.body.visitedAt).getTime();
      expect(visitedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(visitedAt).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('keeps the first visit time when re-marked, and clears it when skipped', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const url = `${VISITS}/${stops[1].id}`;
      const first = await as(tokens.salesman1)
        .patch(url, { status: 'visited' })
        .expect(200);
      const again = await as(tokens.salesman1)
        .patch(url, { status: 'visited', note: 'Came back later' })
        .expect(200);
      expect(again.body.visitedAt).toBe(first.body.visitedAt);

      const skipped = await as(tokens.salesman1)
        .patch(url, { status: 'skipped', note: 'Shop closed' })
        .expect(200);
      expect(skipped.body).toMatchObject({
        status: 'skipped',
        visitedAt: null,
        note: 'Shop closed',
      });
    });

    it('rejects a client-supplied time, half a location, or a bad status', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const url = `${VISITS}/${stops[0].id}`;
      for (const body of [
        { status: 'visited', visitedAt: '2020-01-01T00:00:00Z' },
        { status: 'visited', lat: 27.7 },
        { status: 'visited', lng: 85.3 },
        { status: 'planned' },
        {},
      ]) {
        const res = await as(tokens.salesman1).patch(url, body).expect(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('only the plan’s own salesman can edit its visits', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const url = `${VISITS}/${stops[0].id}`;
      const res = await as(tokens.salesman2)
        .patch(url, { status: 'skipped' })
        .expect(404);
      expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
      await as(tokens.manager).patch(url, { status: 'skipped' }).expect(403);
      expect((await visitsOf(plan.a))[0].status).toBe('planned');
    });
  });

  describe('POST /day-plans/:id/visits', () => {
    let offRoute: string;
    beforeEach(async () => {
      offRoute = randomUUID();
      await db.insert(retailClients).values({
        id: offRoute,
        businessId: seeded.businessId,
        name: 'Walk-in Pasal',
        email: `${offRoute}@shop.test`,
        passwordHash: 'x',
        createdAt: new Date(),
      });
    });
    const add = (token: string, planId: string, clientId: string) =>
      as(token).post(`${PLANS}/${planId}/visits`, { clientId });

    it('adds an ad-hoc shop at the end of the running day', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      const res = await add(tokens.salesman1, plan.a, offRoute).expect(201);
      expect(res.body).toMatchObject({
        dayPlanId: plan.a,
        sequence: 3,
        status: 'planned',
        client: { id: offRoute, name: 'Walk-in Pasal' },
      });

      const full = await as(tokens.salesman1).get(`${PLANS}/${plan.a}`);
      expect(
        full.body.visits.map((v: { client: { id: string } }) => v.client.id),
      ).toEqual([...shopIds, offRoute]);
      // The new visit can be worked like any other.
      await as(tokens.salesman1)
        .patch(`${VISITS}/${res.body.id}`, { status: 'visited' })
        .expect(200);
    });

    it('returns 409 for a shop already on the plan', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      await add(tokens.salesman1, plan.a, offRoute).expect(201);
      for (const clientId of [offRoute, shopIds[1]]) {
        const res = await add(tokens.salesman1, plan.a, clientId).expect(409);
        expect(res.body.error).toMatchObject({
          code: 'VISIT_EXISTS',
          message: 'This shop is already on today’s plan',
        });
      }
      expect(await visitsOf(plan.a)).toHaveLength(4);
    });

    it('needs a running plan of his own', async () => {
      const notStarted = await add(tokens.salesman1, plan.a, offRoute).expect(
        409,
      );
      expect(notStarted.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');

      await start(tokens.salesman2, plan.c).expect(200);
      const notHis = await add(tokens.salesman1, plan.c, offRoute).expect(404);
      expect(notHis.body.error.code).toBe('DAY_PLAN_NOT_FOUND');
      await add(tokens.manager, plan.c, offRoute).expect(403);
      expect(await visitsOf(plan.c)).toHaveLength(3);
    });

    it('rejects a deactivated shop or another business’s shop', async () => {
      await start(tokens.salesman1, plan.a).expect(200);
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.id, offRoute));
      const inactive = await add(tokens.salesman1, plan.a, offRoute).expect(
        409,
      );
      expect(inactive.body.error.code).toBe('CLIENT_INACTIVE');

      const other = await insertBusiness(db);
      const foreign = randomUUID();
      await db.insert(retailClients).values({
        id: foreign,
        businessId: other.id,
        name: 'Foreign',
        email: `${foreign}@shop.test`,
        passwordHash: 'x',
        createdAt: new Date(),
      });
      const res = await add(tokens.salesman1, plan.a, foreign).expect(404);
      expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
      expect(await visitsOf(plan.a)).toHaveLength(3);
    });
  });
});
