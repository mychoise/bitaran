import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  invoiceCounters,
  payments,
  products,
  retailClients,
  routeClients,
  saleItems,
  saleReturns,
  sales,
  users,
  visits,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { BalanceService } from '../src/ledger/balance.service.js';
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
type Client = typeof retailClients.$inferSelect;
type PlanStatus = (typeof dayPlans.$inferSelect)['status'];

const SALES = '/api/v1/sales';
const PLANS = '/api/v1/day-plans';

// Seeded prices (paisa): NDL-70 2000 / carton of 30 at 57000;
// WTR-1L 2500 / carton of 12 at 28000; CLA-500 5500 / carton of 24 at 126000.
// The fixture plan carries NDL 2 cartons (60), WTR 20 pieces, CLA 1 carton (24).

describe('Sales (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>;
  let shops: Client[]; // in route order
  let planId: string; // salesman1, today, in progress
  const tokens = {} as Record<
    'owner' | 'manager' | 'salesman1' | 'salesman2' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object, headers: Record<string, string> = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).set(headers).send(body),
  });
  const sell = (
    token: string,
    body: object,
    key: string | null = `sale-${randomUUID()}`,
  ) =>
    as(token).post(SALES, body, key === null ? {} : { 'Idempotency-Key': key });
  const line = (sku: string, quantity: number, unit = 'base') => ({
    productId: p[sku].id,
    unit,
    quantity,
  });
  const counter = async () =>
    (
      await db
        .select()
        .from(invoiceCounters)
        .where(eq(invoiceCounters.businessId, seeded.businessId))
    )[0].lastNumber;
  const counts = async () => ({
    sales: (await db.select().from(sales)).length,
    items: (await db.select().from(saleItems)).length,
    payments: (await db.select().from(payments)).length,
  });
  const setPlanStatus = (id: string, status: PlanStatus) =>
    db.update(dayPlans).set({ status }).where(eq(dayPlans.id, id));
  const makeRunningPlan = async (
    salesman: User,
    token: string,
    stock: object[],
  ) => {
    const id = (
      await as(tokens.manager)
        .post(PLANS, {
          salesmanId: salesman.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock,
        })
        .expect(201)
    ).body.id as string;
    await as(token).post(`${PLANS}/${id}/start`, {}).expect(200);
    return id;
  };

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
    planId = await makeRunningPlan(staff.salesman1, tokens.salesman1, [
      line('NDL-70', 2, 'carton'),
      line('WTR-1L', 20),
      line('CLA-500', 1, 'carton'),
    ]);
    const b = await insertBusiness(db);
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, b.id, { role: 'owner' }),
    );
  });
  afterAll(() => app.close());

  describe('creating a sale', () => {
    it('prices from the database, computes totals, and stamps today’s date', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 3), line('WTR-1L', 2)],
        discountPaisa: 500,
      }).expect(201);
      expect(res.body).toMatchObject({
        invoiceNumber: 1,
        saleDate: nepalToday(),
        status: 'confirmed',
        subtotalPaisa: 3 * 2000 + 2 * 2500,
        discountPaisa: 500,
        totalPaisa: 11_000 - 500,
        dayPlanId: planId,
        client: { id: shops[0].id },
        salesman: { id: staff.salesman1.id },
        payments: [],
      });
      expect(res.body.items).toEqual([
        expect.objectContaining({
          productName: 'Instant Noodles 70g',
          unit: 'base',
          quantity: 3,
          unitPricePaisa: 2000,
          lineTotalPaisa: 6000,
        }),
        expect.objectContaining({
          productName: 'Mineral Water 1L',
          unit: 'base',
          quantity: 2,
          unitPricePaisa: 2500,
          lineTotalPaisa: 5000,
        }),
      ]);
    });

    it('ignores any price or total the client sends', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [{ ...line('NDL-70', 2), unitPricePaisa: 1, lineTotalPaisa: 2 }],
        totalPaisa: 2,
        subtotalPaisa: 2,
      }).expect(201);
      expect(res.body.items[0]).toMatchObject({
        unitPricePaisa: 2000,
        lineTotalPaisa: 4000,
      });
      expect(res.body.totalPaisa).toBe(4000);
      const [stored] = await db.select().from(saleItems);
      expect(stored.unitPricePaisa).toBe(2000);
    });

    it('carton lines use the carton price and consume units_per_carton base units', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 1, 'carton')],
      }).expect(201);
      expect(res.body.items[0]).toMatchObject({
        unit: 'carton',
        quantity: 1,
        unitPricePaisa: 57_000,
        lineTotalPaisa: 57_000,
      });
      // 60 issued, 30 sold: exactly 30 base units are left.
      const over = await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 31)],
      }).expect(409);
      expect(over.body.error.details).toEqual([
        expect.objectContaining({ requested: 31, available: 30 }),
      ]);
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 30)],
      }).expect(201);
    });

    it('keeps the sale’s copy of name and price when the product changes later', async () => {
      const sale = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('WTR-1L', 1)],
        })
      ).body;
      await db
        .update(products)
        .set({ name: 'Renamed', pricePaisa: 9999 })
        .where(eq(products.id, p['WTR-1L'].id));
      const res = await as(tokens.manager).get(`${SALES}/${sale.id}`);
      expect(res.body.items[0]).toMatchObject({
        productName: 'Mineral Water 1L',
        unitPricePaisa: 2500,
      });
    });

    it('does not change warehouse stock', async () => {
      const before = (
        await db.select().from(products).where(eq(products.id, p['NDL-70'].id))
      )[0].stockQuantity;
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 10)],
      }).expect(201);
      const after = (
        await db.select().from(products).where(eq(products.id, p['NDL-70'].id))
      )[0].stockQuantity;
      expect(after).toBe(before);
    });

    it('records cash paid now as a confirmed cash payment on the sale', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 4)],
        cashPaidNowPaisa: 6000,
      }).expect(201);
      expect(res.body.payments).toEqual([
        expect.objectContaining({
          method: 'cash',
          status: 'confirmed',
          amountPaisa: 6000,
        }),
      ]);
      const [payment] = await db.select().from(payments);
      expect(payment).toMatchObject({
        saleId: res.body.id,
        dayPlanId: planId,
        clientId: shops[0].id,
        collectedBy: staff.salesman1.id,
      });
    });

    it.each([
      [
        'a discount above the subtotal',
        () => ({ discountPaisa: 2001 }),
        422,
        'DISCOUNT_EXCEEDS_SUBTOTAL',
      ],
      [
        'cash above the total',
        () => ({ cashPaidNowPaisa: 2001 }),
        422,
        'CASH_EXCEEDS_TOTAL',
      ],
      [
        'a due date before today',
        () => ({ dueDate: '2020-01-01' }),
        400,
        'DUE_DATE_IN_PAST',
      ],
      ['no items', () => ({ items: [] }), 400, 'VALIDATION_FAILED'],
      [
        'the same product and unit twice',
        () => ({ items: [line('NDL-70', 1), line('NDL-70', 2)] }),
        400,
        'DUPLICATE_SALE_LINE',
      ],
      [
        'a zero quantity',
        () => ({ items: [line('NDL-70', 0)] }),
        400,
        'VALIDATION_FAILED',
      ],
      [
        'a carton of a product with no carton price',
        () => ({ items: [line('LOOSE', 1, 'carton')] }),
        422,
        'NO_CARTON_PRICE',
      ],
    ])('rejects %s', async (_label, makeOverrides, status, code) => {
      p.LOOSE = await insertProduct(db, seeded.businessId, {
        sku: 'LOOSE',
        unitsPerCarton: 10,
      });
      const before = await counter();
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 1)],
        ...makeOverrides(),
      });
      expect([res.status, res.body.error?.code]).toEqual([status, code]);
      expect(await counts()).toEqual({ sales: 0, items: 0, payments: 0 });
      expect(await counter()).toBe(before);
    });

    it('allows a discount equal to the subtotal', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 1)],
        discountPaisa: 2000,
      }).expect(201);
      expect(res.body.totalPaisa).toBe(0);
    });

    it('requires an Idempotency-Key header', async () => {
      for (const key of [null, 'short', 'has spaces in it']) {
        const res = await sell(
          tokens.salesman1,
          { clientId: shops[0].id, items: [line('NDL-70', 1)] },
          key,
        ).expect(400);
        expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      }
    });
  });

  describe('plan stock', () => {
    it('rejects selling more than the plan has left, listing each shortage', async () => {
      const res = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [
          line('NDL-70', 1, 'carton'),
          line('NDL-70', 31), // 30 + 31 = 61 > 60
          line('WTR-1L', 5), // fine
          line('BSC-100', 1), // not on the plan at all
        ],
      }).expect(409);
      expect(res.body.error.code).toBe('INSUFFICIENT_PLAN_STOCK');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: p['NDL-70'].id,
            requested: 61,
            available: 60,
          }),
          expect.objectContaining({
            productId: p['BSC-100'].id,
            requested: 1,
            available: 0,
          }),
        ]),
      );
      expect(res.body.error.details).toHaveLength(2);
      expect(await counts()).toEqual({ sales: 0, items: 0, payments: 0 });
    });

    it('counts earlier sales on the plan against what is left', async () => {
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('CLA-500', 20)],
      }).expect(201);
      const res = await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('CLA-500', 5)],
      }).expect(409);
      expect(res.body.error.details[0]).toMatchObject({
        requested: 5,
        available: 4,
      });
    });

    it('cannot be oversold by concurrent sales', async () => {
      // 24 cola on the plan; three sales of 10 at once.
      const results = await Promise.all(
        [0, 1, 2].map((i) =>
          sell(tokens.salesman1, {
            clientId: shops[i].id,
            items: [line('CLA-500', 10)],
          }),
        ),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 201, 409,
      ]);
    });
  });

  describe('invoice numbers', () => {
    it('two simultaneous sales never get the same invoice number', async () => {
      // Two salesmen on two plans, so the plan lock does not serialise them;
      // only the counter does.
      await setPlanStatus(planId, 'in_progress');
      await db.update(retailClients).set({ creditLimitPaisa: 100_000_000 });
      const plan2 = await makeRunningPlan(staff.salesman2, tokens.salesman2, [
        line('WTR-1L', 100),
      ]);
      const attempts = [
        ...Array.from({ length: 6 }, (_, i) =>
          sell(tokens.salesman1, {
            clientId: shops[i % 3].id,
            items: [line('WTR-1L', 1)],
          }),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          sell(tokens.salesman2, {
            clientId: shops[i % 3].id,
            dayPlanId: plan2,
            items: [line('WTR-1L', 1)],
          }),
        ),
      ];
      const results = await Promise.all(attempts);
      expect(results.map((r) => r.status)).toEqual(Array(12).fill(201));
      const numbers = results.map((r) => r.body.invoiceNumber as number);
      expect(new Set(numbers).size).toBe(12);
      expect([...numbers].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 12 }, (_, i) => i + 1),
      );
      expect(await counter()).toBe(12);
    });

    it('a failure halfway leaves no sale, no items, no payment and no invoice change', async () => {
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 1)],
      }).expect(201);
      const before = await counts();
      // Fail on the very last write, after the counter, sale and items.
      await db.execute(sql`
        create or replace function test_fail_payment() returns trigger as $$
        begin raise exception 'injected failure'; end $$ language plpgsql;
        create trigger test_fail_payment before insert on payments
          for each row execute function test_fail_payment();
      `);
      try {
        const res = await sell(tokens.salesman1, {
          clientId: shops[1].id,
          items: [line('NDL-70', 5), line('WTR-1L', 2)],
          cashPaidNowPaisa: 1000,
        }).expect(500);
        expect(res.body.error.code).toBe('INTERNAL_ERROR');
      } finally {
        await db.execute(sql`
          drop trigger test_fail_payment on payments;
          drop function test_fail_payment();
        `);
      }
      expect(await counts()).toEqual(before);
      expect(await counter()).toBe(1);
      // The next sale gets the next number: nothing was used up.
      const next = await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('WTR-1L', 1)],
      }).expect(201);
      expect(next.body.invoiceNumber).toBe(2);
    });
  });

  describe('Idempotency-Key', () => {
    const body = () => ({
      clientId: shops[0].id,
      items: [line('NDL-70', 2)],
      cashPaidNowPaisa: 1000,
    });

    it('a repeated key returns the first sale and creates nothing new', async () => {
      const key = `retry-${randomUUID()}`;
      const first = await sell(tokens.salesman1, body(), key).expect(201);
      const after = await counts();
      const again = await sell(tokens.salesman1, body(), key).expect(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.body).toEqual(first.body);
      expect(await counts()).toEqual(after);
      expect(after).toEqual({ sales: 1, items: 1, payments: 1 });
      expect(await counter()).toBe(1);
    });

    it('creates one sale when the same key arrives twice at once', async () => {
      const key = `race-${randomUUID()}`;
      const results = await Promise.all([
        sell(tokens.salesman1, body(), key),
        sell(tokens.salesman1, body(), key),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 201,
      ]);
      expect(results[0].body.id).toBe(results[1].body.id);
      expect(await counts()).toEqual({ sales: 1, items: 1, payments: 1 });
    });

    it('refuses a key reused for another shop or by another salesman', async () => {
      const key = `reuse-${randomUUID()}`;
      await sell(tokens.salesman1, body(), key).expect(201);
      const otherShop = await sell(
        tokens.salesman1,
        { ...body(), clientId: shops[1].id },
        key,
      ).expect(409);
      expect(otherShop.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      await sell(tokens.salesman2, body(), key).expect(409);
      expect((await counts()).sales).toBe(1);
    });

    it('scopes keys to the business', async () => {
      const key = `shared-${randomUUID()}`;
      await sell(tokens.salesman1, body(), key).expect(201);
      // Business B using the same key is a different request (and fails on
      // its own merits: it has no plan running).
      const res = await sell(tokens.bOwner, body(), key);
      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(res.status).not.toBe(200);
    });
  });

  describe('credit limit', () => {
    beforeEach(async () => {
      await db
        .update(retailClients)
        .set({ creditLimitPaisa: 6000, openingBalancePaisa: 0 })
        .where(eq(retailClients.id, shops[0].id));
    });
    const waters = (n: number, extra: object = {}) => ({
      clientId: shops[0].id,
      items: [line('WTR-1L', n)],
      ...extra,
    });

    it('is enforced for salesmen', async () => {
      await sell(tokens.salesman1, waters(2)).expect(201); // balance 5000
      const res = await sell(tokens.salesman1, waters(2)).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'CREDIT_LIMIT_EXCEEDED',
        details: [
          { balanceBefore: 5000, balanceAfter: 10_000, creditLimit: 6000 },
        ],
      });
      expect((await counts()).sales).toBe(1);
    });

    it('counts cash paid now: reaching the limit exactly is allowed', async () => {
      await sell(tokens.salesman1, waters(2)).expect(201); // 5000
      await sell(
        tokens.salesman1,
        waters(2, { cashPaidNowPaisa: 4000 }),
      ).expect(201); // 5000 + 5000 - 4000 = 6000
      await sell(
        tokens.salesman1,
        waters(1, { cashPaidNowPaisa: 2499 }),
      ).expect(409);
    });

    it('includes the opening balance and earlier payments', async () => {
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: 5000 })
        .where(eq(retailClients.id, shops[0].id));
      await sell(tokens.salesman1, waters(1)).expect(409); // 7500
      await db.insert(payments).values({
        id: randomUUID(),
        businessId: seeded.businessId,
        clientId: shops[0].id,
        collectedBy: staff.manager.id,
        method: 'cash',
        amountPaisa: 2000,
        receivedAt: new Date(),
        createdAt: new Date(),
      });
      await sell(tokens.salesman1, waters(1)).expect(201); // 5500
    });

    it('is not enforced for managers or owners', async () => {
      await sell(tokens.manager, waters(3, { dayPlanId: planId })).expect(201);
      await sell(tokens.owner, waters(3, { dayPlanId: planId })).expect(201);
      expect((await counts()).sales).toBe(2);
    });

    it('never blocks a sale paid fully in cash, even over the limit', async () => {
      await sell(tokens.manager, waters(4, { dayPlanId: planId })).expect(201); // 10000
      await sell(
        tokens.salesman1,
        waters(2, { cashPaidNowPaisa: 5000 }),
      ).expect(201);
      await sell(tokens.salesman1, waters(1)).expect(409);
    });

    it('a shop with a zero limit can only buy for cash from a salesman', async () => {
      await db
        .update(retailClients)
        .set({ creditLimitPaisa: 0 })
        .where(eq(retailClients.id, shops[0].id));
      await sell(tokens.salesman1, waters(1)).expect(409);
      await sell(
        tokens.salesman1,
        waters(1, { cashPaidNowPaisa: 2500 }),
      ).expect(201);
    });

    it('cannot be beaten by concurrent sales to the same shop from different plans', async () => {
      // Different plans, so only the shop lock stands between them. The
      // limit fits one 2500 sale; two at once must not both get through.
      await db
        .update(retailClients)
        .set({ creditLimitPaisa: 3000 })
        .where(eq(retailClients.id, shops[0].id));
      const plan2 = await makeRunningPlan(staff.salesman2, tokens.salesman2, [
        line('WTR-1L', 10),
      ]);
      for (let round = 0; round < 3; round++) {
        await db.delete(saleItems);
        await db.delete(sales);
        const results = await Promise.all([
          sell(tokens.salesman1, waters(1)),
          sell(tokens.salesman2, waters(1, { dayPlanId: plan2 })),
        ]);
        expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
          201, 409,
        ]);
      }
    });
  });

  describe('which plan and who', () => {
    it('a salesman sells only from his running plan', async () => {
      await setPlanStatus(planId, 'closed');
      const none = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 1)],
      }).expect(409);
      expect(none.body.error.code).toBe('NO_DAY_IN_PROGRESS');

      const named = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        dayPlanId: planId,
        items: [line('NDL-70', 1)],
      }).expect(409);
      expect(named.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
    });

    it('a salesman cannot sell from another salesman’s plan', async () => {
      const res = await sell(tokens.salesman2, {
        clientId: shops[0].id,
        dayPlanId: planId,
        items: [line('NDL-70', 1)],
      }).expect(404);
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_FOUND');
    });

    it('a manager must name the plan, and the sale is the plan salesman’s', async () => {
      const missing = await sell(tokens.manager, {
        clientId: shops[0].id,
        items: [line('NDL-70', 1)],
      }).expect(400);
      expect(missing.body.error.code).toBe('DAY_PLAN_REQUIRED');

      const res = await sell(tokens.manager, {
        clientId: shops[0].id,
        dayPlanId: planId,
        items: [line('NDL-70', 1)],
        cashPaidNowPaisa: 2000,
      }).expect(201);
      expect(res.body.salesman.id).toBe(staff.salesman1.id);
      const [payment] = await db.select().from(payments);
      expect(payment.collectedBy).toBe(staff.manager.id);
    });

    it('links a visit, finding the plan from it, and checks it is the same shop', async () => {
      const [visit] = await db
        .select()
        .from(visits)
        .where(
          and(eq(visits.dayPlanId, planId), eq(visits.clientId, shops[1].id)),
        );
      const wrongShop = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        visitId: visit.id,
        items: [line('NDL-70', 1)],
      }).expect(422);
      expect(wrongShop.body.error.code).toBe('VISIT_MISMATCH');

      const res = await sell(tokens.manager, {
        clientId: shops[1].id,
        visitId: visit.id,
        items: [line('NDL-70', 1)],
      }).expect(201);
      expect(res.body).toMatchObject({ visitId: visit.id, dayPlanId: planId });
    });

    it('rejects a deactivated shop, and another business’s shop or product', async () => {
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.id, shops[2].id));
      const inactive = await sell(tokens.salesman1, {
        clientId: shops[2].id,
        items: [line('NDL-70', 1)],
      }).expect(409);
      expect(inactive.body.error.code).toBe('CLIENT_INACTIVE');

      const other = await insertBusiness(db);
      const foreignProduct = await insertProduct(db, other.id);
      const foreignShop = randomUUID();
      await db.insert(retailClients).values({
        id: foreignShop,
        businessId: other.id,
        name: 'Foreign',
        email: `${foreignShop}@x.test`,
        passwordHash: 'x',
        createdAt: new Date(),
      });
      const shop = await sell(tokens.salesman1, {
        clientId: foreignShop,
        items: [line('NDL-70', 1)],
      }).expect(404);
      expect(shop.body.error.code).toBe('CLIENT_NOT_FOUND');
      const product = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [{ productId: foreignProduct.id, unit: 'base', quantity: 1 }],
      }).expect(404);
      expect(product.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('cancelling', () => {
    const sellAllNoodles = () =>
      sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('NDL-70', 2, 'carton')],
      }).expect(201);

    it('cancelling frees the plan stock and keeps the invoice number', async () => {
      const sale = (await sellAllNoodles()).body;
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 1)],
      }).expect(409);

      const res = await as(tokens.salesman1)
        .post(`${SALES}/${sale.id}/cancel`, { reason: 'Wrong shop' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'cancelled',
        cancelReason: 'Wrong shop',
        invoiceNumber: sale.invoiceNumber,
      });

      const next = await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 60)],
      }).expect(201);
      expect(next.body.invoiceNumber).toBe(sale.invoiceNumber + 1);
    });

    it('a cancelled sale stops counting in balances and items taken', async () => {
      const sale = (await sellAllNoodles()).body;
      const shopsBefore = await as(tokens.salesman1).get(
        `${PLANS}/${planId}/shops`,
      );
      expect(shopsBefore.body[0]).toMatchObject({
        balancePaisa: 114_000,
        purchasedOnPlanPaisa: 114_000,
      });
      await as(tokens.manager)
        .post(`${SALES}/${sale.id}/cancel`, { reason: 'Duplicate' })
        .expect(200);

      const shopsAfter = await as(tokens.salesman1).get(
        `${PLANS}/${planId}/shops`,
      );
      expect(shopsAfter.body[0]).toMatchObject({
        balancePaisa: 0,
        purchasedOnPlanPaisa: 0,
      });
      const taken = await as(tokens.manager).get(
        `/api/v1/clients/${shops[0].id}/items-taken`,
      );
      expect(taken.body).toEqual([]);
    });

    it('cancelling a sale with a confirmed payment is rejected', async () => {
      const sale = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('WTR-1L', 2)],
          cashPaidNowPaisa: 1000,
        }).expect(201)
      ).body;
      for (const token of [tokens.salesman1, tokens.owner]) {
        const res = await as(token)
          .post(`${SALES}/${sale.id}/cancel`, { reason: 'Changed mind' })
          .expect(409);
        expect(res.body.error).toMatchObject({
          code: 'SALE_HAS_PAYMENT',
          message: expect.stringContaining('Record a return instead'),
        });
      }
      const [row] = await db.select().from(sales);
      expect(row.status).toBe('confirmed');
    });

    it('a salesman cancels only his own sale, only while his day runs', async () => {
      const sale = (await sellAllNoodles()).body;
      const url = `${SALES}/${sale.id}/cancel`;
      await as(tokens.salesman2).post(url, { reason: 'x' }).expect(404);

      await setPlanStatus(planId, 'closed');
      const late = await as(tokens.salesman1)
        .post(url, { reason: 'x' })
        .expect(403);
      expect(late.body.error.code).toBe('SALE_NOT_CANCELLABLE');

      // A manager can still cancel it.
      await as(tokens.manager).post(url, { reason: 'Late fix' }).expect(200);
      const again = await as(tokens.manager)
        .post(url, { reason: 'Again' })
        .expect(409);
      expect(again.body.error.code).toBe('SALE_ALREADY_CANCELLED');
    });

    it('requires a reason', async () => {
      const sale = (await sellAllNoodles()).body;
      await as(tokens.manager)
        .post(`${SALES}/${sale.id}/cancel`, { reason: '  ' })
        .expect(400);
    });
  });

  describe('reading sales', () => {
    let s1: string; // salesman1, shop 0
    let s2: string; // salesman2, shop 1, cancelled
    beforeEach(async () => {
      s1 = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('NDL-70', 1, 'carton'), line('WTR-1L', 3)],
        }).expect(201)
      ).body.id;
      const plan2 = await makeRunningPlan(staff.salesman2, tokens.salesman2, [
        line('WTR-1L', 10),
      ]);
      s2 = (
        await sell(tokens.salesman2, {
          clientId: shops[1].id,
          dayPlanId: plan2,
          items: [line('WTR-1L', 2)],
        }).expect(201)
      ).body.id;
      await as(tokens.manager)
        .post(`${SALES}/${s2}/cancel`, { reason: 'Test' })
        .expect(200);
    });
    const ids = (res: request.Response) =>
      res.body.data.map((s: { id: string }) => s.id);

    it('salesmen see only their own sales', async () => {
      expect(ids(await as(tokens.salesman1).get(SALES))).toEqual([s1]);
      expect(
        ids(
          await as(tokens.salesman1).get(
            `${SALES}?salesmanId=${staff.salesman2.id}`,
          ),
        ),
      ).toEqual([s1]);
      await as(tokens.salesman1).get(`${SALES}/${s2}`).expect(404);
    });

    it('managers see all, filtered by date, salesman, client and status', async () => {
      expect(ids(await as(tokens.manager).get(SALES))).toEqual([s2, s1]);
      const q = (query: string) => as(tokens.manager).get(`${SALES}?${query}`);
      expect(ids(await q(`salesmanId=${staff.salesman2.id}`))).toEqual([s2]);
      expect(ids(await q(`clientId=${shops[0].id}`))).toEqual([s1]);
      expect(ids(await q('status=confirmed'))).toEqual([s1]);
      expect(ids(await q(`from=${nepalToday()}&to=${nepalToday()}`))).toEqual([
        s2,
        s1,
      ]);
      expect(ids(await q('from=2020-01-01&to=2020-12-31'))).toEqual([]);
    });

    it('GET /sales/:id returns the items', async () => {
      const res = await as(tokens.salesman1).get(`${SALES}/${s1}`).expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.subtotalPaisa).toBe(57_000 + 7500);
    });

    it('GET /clients/:id/sales shows a shop’s history to any staff', async () => {
      const res = await as(tokens.salesman2)
        .get(`/api/v1/clients/${shops[0].id}/sales`)
        .expect(200);
      expect(ids(res)).toEqual([s1]);
    });

    it('GET /clients/:id/items-taken groups confirmed sales by product and unit', async () => {
      const plan2Sale = await sell(tokens.manager, {
        clientId: shops[0].id,
        dayPlanId: planId,
        items: [line('WTR-1L', 4), line('NDL-70', 5)],
      }).expect(201);
      const res = await as(tokens.manager)
        .get(`/api/v1/clients/${shops[0].id}/items-taken`)
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({
          productId: p['NDL-70'].id,
          unit: 'base',
          quantity: 5,
          totalPaisa: 10_000,
        }),
        expect.objectContaining({
          productId: p['NDL-70'].id,
          unit: 'carton',
          quantity: 1,
          totalPaisa: 57_000,
        }),
        expect.objectContaining({
          productId: p['WTR-1L'].id,
          unit: 'base',
          quantity: 7,
          totalPaisa: 17_500,
          lastSaleDate: nepalToday(),
        }),
      ]);
      expect(plan2Sale.body.id).toBeDefined();
      // Shop 1's only sale was cancelled.
      const cancelledOnly = await as(tokens.manager).get(
        `/api/v1/clients/${shops[1].id}/items-taken`,
      );
      expect(cancelledOnly.body).toEqual([]);
    });

    it('another business sees nothing', async () => {
      await as(tokens.bOwner).get(`${SALES}/${s1}`).expect(404);
      expect((await as(tokens.bOwner).get(SALES)).body.total).toBe(0);
      await as(tokens.bOwner)
        .get(`/api/v1/clients/${shops[0].id}/items-taken`)
        .expect(404);
      await as(tokens.bOwner)
        .post(`${SALES}/${s1}/cancel`, { reason: 'x' })
        .expect(404);
    });
  });

  describe('GET /day-plans/:id/shops', () => {
    it('lists each visit with its shop, status, balance and purchases on this plan', async () => {
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: 1000 })
        .where(eq(retailClients.id, shops[1].id));
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('WTR-1L', 2)],
        cashPaidNowPaisa: 1500,
      }).expect(201);
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 1)],
      }).expect(201);

      const res = await as(tokens.salesman1)
        .get(`${PLANS}/${planId}/shops`)
        .expect(200);
      expect(res.body.map((r: { shop: { id: string } }) => r.shop.id)).toEqual(
        shops.map((s) => s.id),
      );
      expect(res.body[1]).toMatchObject({
        visit: { sequence: 1, status: 'planned' },
        shop: { name: shops[1].name, creditLimitPaisa: 5_000_000 },
        balancePaisa: 1000 + 5000 + 2000 - 1500,
        purchasedOnPlanPaisa: 7000,
      });
      expect(res.body[0]).toMatchObject({
        balancePaisa: 0,
        purchasedOnPlanPaisa: 0,
      });
    });

    it('is visible to the plan’s salesman and managers only', async () => {
      await as(tokens.salesman2).get(`${PLANS}/${planId}/shops`).expect(404);
      await as(tokens.manager).get(`${PLANS}/${planId}/shops`).expect(200);
      await as(tokens.bOwner).get(`${PLANS}/${planId}/shops`).expect(404);
    });
  });

  describe('BalanceService', () => {
    const pay = (
      clientId: string,
      amountPaisa: number,
      status: 'pending' | 'confirmed' | 'bounced',
    ) =>
      db.insert(payments).values({
        id: randomUUID(),
        businessId: seeded.businessId,
        clientId,
        collectedBy: staff.manager.id,
        method: 'cheque',
        status,
        amountPaisa,
        receivedAt: new Date(),
        createdAt: new Date(),
      });

    it('is opening + confirmed sales - confirmed payments - returns, per shop', async () => {
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: 10_000 })
        .where(eq(retailClients.id, shops[0].id));
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: -3000 })
        .where(eq(retailClients.id, shops[2].id));
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 4)],
      }).expect(201); // +10000
      const cancelled = await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 1)],
      }).expect(201);
      await as(tokens.manager)
        .post(`${SALES}/${cancelled.body.id}/cancel`, { reason: 'x' })
        .expect(200); // does not count
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 3)],
      }).expect(201); // shop 1: +6000
      await pay(shops[0].id, 4000, 'confirmed');
      await pay(shops[0].id, 50_000, 'pending'); // not yet
      await pay(shops[0].id, 70_000, 'bounced'); // never
      await db.insert(saleReturns).values({
        id: randomUUID(),
        businessId: seeded.businessId,
        clientId: shops[0].id,
        receivedBy: staff.manager.id,
        returnDate: nepalToday(),
        totalPaisa: 1500,
        createdAt: new Date(),
      });

      const balances = await app.get(BalanceService).balancesOf(
        seeded.businessId,
        shops.map((s) => s.id),
      );
      expect(Object.fromEntries(balances)).toEqual({
        [shops[0].id]: 10_000 + 10_000 - 4000 - 1500,
        [shops[1].id]: 6000,
        [shops[2].id]: -3000,
      });
    });

    it('never reports another business’s shop', async () => {
      const other = await insertBusiness(db);
      const foreign = randomUUID();
      await db.insert(retailClients).values({
        id: foreign,
        businessId: other.id,
        name: 'Foreign',
        email: `${foreign}@x.test`,
        passwordHash: 'x',
        openingBalancePaisa: 999,
        createdAt: new Date(),
      });
      const balances = await app
        .get(BalanceService)
        .balancesOf(seeded.businessId, [foreign, shops[0].id]);
      expect([...balances.keys()]).toEqual([shops[0].id]);
    });
  });
});
