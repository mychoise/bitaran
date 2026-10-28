import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  products,
  retailClients,
  routeClients,
  saleReturns,
  stockWriteOffs,
  users,
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
const RETURNS = '/api/v1/returns';
const WRITE_OFFS = '/api/v1/write-offs';

// Seeded: NDL-70 2000 / carton of 30 at 57,000, cost 1700, 3000 in stock;
// WTR-1L 2500 / carton of 12 at 28,000, cost 1800, 1200 in stock.
// The plan carries NDL 2 cartons + 20 pieces (80), WTR 24, CLA 1 carton.
// The sale to shop 0: NDL 1 carton + 10 pieces, WTR 4 = 87,000.

describe('Returns and write-offs (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>;
  let shops: Client[];
  let planId: string;
  let sale: { id: string; totalPaisa: number };
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
  const item = (
    sku: string,
    quantity: number,
    reason = 'damaged',
    extra: object = {},
    unit = 'base',
  ) => ({ productId: p[sku].id, unit, quantity, reason, ...extra });
  const giveBack = (token: string, body: object) =>
    as(token).post(RETURNS, { clientId: shops[0].id, ...body });
  const writeOff = (token: string, body: object) =>
    as(token).post(WRITE_OFFS, {
      productId: p['NDL-70'].id,
      unit: 'base',
      quantity: 1,
      reason: 'damaged',
      ...body,
    });
  const warehouse = async () =>
    Object.fromEntries(
      (
        await db
          .select({ sku: products.sku, q: products.stockQuantity })
          .from(products)
      ).map((r) => [r.sku, r.q]),
    );
  const balanceOf = async (shop: Client) =>
    (
      await as(tokens.manager)
        .get(`/api/v1/clients/${shop.id}/balance`)
        .expect(200)
    ).body.balancePaisa as number;
  const returnCount = async () => (await db.select().from(saleReturns)).length;

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

    const line = (sku: string, unit: string, quantity: number) => ({
      productId: p[sku].id,
      unit,
      quantity,
    });
    planId = (
      await as(tokens.manager)
        .post(PLANS, {
          salesmanId: staff.salesman1.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock: [
            line('NDL-70', 'carton', 2),
            line('NDL-70', 'base', 20),
            line('WTR-1L', 'base', 24),
            line('CLA-500', 'carton', 1),
          ],
        })
        .expect(201)
    ).body.id;
    await as(tokens.salesman1).post(`${PLANS}/${planId}/start`, {}).expect(200);
    sale = (
      await as(tokens.salesman1)
        .post(
          '/api/v1/sales',
          {
            clientId: shops[0].id,
            items: [
              line('NDL-70', 'carton', 1),
              line('NDL-70', 'base', 10),
              line('WTR-1L', 'base', 4),
            ],
          },
          { 'Idempotency-Key': `sale-${randomUUID()}` },
        )
        .expect(201)
    ).body;
  });
  afterAll(() => app.close());

  describe('returns', () => {
    it('a return lowers the shop’s balance by its server-computed total', async () => {
      expect(await balanceOf(shops[0])).toBe(87_000);
      const res = await giveBack(tokens.salesman1, {
        saleId: sale.id,
        note: 'Crushed in transit',
        items: [
          item('WTR-1L', 2, 'damaged', { lineTotalPaisa: 1 }),
          item('NDL-70', 3, 'expired'),
        ],
      });
      // An unknown field (a client-sent total) is refused outright.
      expect(res.status).toBe(400);

      const ok = await giveBack(tokens.salesman1, {
        saleId: sale.id,
        note: 'Crushed in transit',
        items: [item('WTR-1L', 2, 'damaged'), item('NDL-70', 3, 'expired')],
      }).expect(201);
      expect(ok.body).toMatchObject({
        saleId: sale.id,
        dayPlanId: planId,
        returnDate: nepalToday(),
        totalPaisa: 2 * 2500 + 3 * 2000,
        client: { id: shops[0].id },
        receivedBy: { id: staff.salesman1.id },
      });
      expect(ok.body.items).toEqual([
        expect.objectContaining({
          productName: 'Instant Noodles 70g',
          unit: 'base',
          quantity: 3,
          unitPricePaisa: 2000,
          lineTotalPaisa: 6000,
          reason: 'expired',
          restocked: false,
        }),
        expect.objectContaining({
          productName: 'Mineral Water 1L',
          quantity: 2,
          unitPricePaisa: 2500,
          lineTotalPaisa: 5000,
          reason: 'damaged',
          restocked: false,
        }),
      ]);
      expect(await balanceOf(shops[0])).toBe(87_000 - 11_000);
    });

    it('returning more than was sold is rejected', async () => {
      const over = await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 5)],
      }).expect(409);
      expect(over.body.error).toMatchObject({
        code: 'RETURN_EXCEEDS_SOLD',
        details: [
          {
            productId: p['WTR-1L'].id,
            unit: 'base',
            requested: 5,
            returnable: 4,
          },
        ],
      });

      // Earlier returns count; so do several lines for the same product.
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 3)],
      }).expect(201);
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 2)],
      }).expect(409);
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 1), item('WTR-1L', 1, 'expired')],
      }).expect(409);
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 1)],
      }).expect(201);
      expect(await returnCount()).toBe(2);
    });

    it('two returns at once against one sale cannot both exceed it', async () => {
      const results = await Promise.all(
        [0, 1].map(() =>
          giveBack(tokens.salesman1, {
            saleId: sale.id,
            items: [item('WTR-1L', 3)],
          }),
        ),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
    });

    it('only returns what was on the sale, in the unit it was sold in', async () => {
      for (const [sku, unit] of [
        ['CLA-500', 'base'],
        ['WTR-1L', 'carton'],
      ]) {
        const res = await giveBack(tokens.salesman1, {
          saleId: sale.id,
          items: [item(sku, 1, 'damaged', {}, unit)],
        }).expect(422);
        expect(res.body.error.code).toBe('ITEM_NOT_IN_SALE');
      }
    });

    it('damaged and expired goods are not restocked', async () => {
      const before = await warehouse();
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 2, 'damaged'), item('NDL-70', 4, 'expired')],
      }).expect(201);
      expect(await warehouse()).toEqual(before);
    });

    it.each(['damaged', 'expired'])(
      'restocked: true with reason %s is rejected, creating nothing',
      async (reason) => {
        const res = await giveBack(tokens.salesman1, {
          saleId: sale.id,
          items: [item('WTR-1L', 1, reason, { restocked: true })],
        }).expect(400);
        expect(res.body.error.code).toBe('RESTOCK_NOT_ALLOWED');
        expect(await returnCount()).toBe(0);
      },
    );

    it('restocks reason "other" goods when asked, converting cartons', async () => {
      const before = await warehouse();
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [
          item('NDL-70', 1, 'other', { restocked: true }, 'carton'),
          item('NDL-70', 2, 'other', { restocked: true }),
          item('WTR-1L', 1, 'other'), // not asked to restock
        ],
      }).expect(201);
      expect(await warehouse()).toEqual({
        ...before,
        'NDL-70': before['NDL-70'] + 30 + 2,
      });
    });

    it('with a sale, the price is the sale’s even if the product changed since', async () => {
      await db
        .update(products)
        .set({ pricePaisa: 9999 })
        .where(eq(products.id, p['WTR-1L'].id));
      const res = await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 1)],
      }).expect(201);
      expect(res.body.items[0].unitPricePaisa).toBe(2500);
    });

    it('a manager may lower the sale price on a return, never raise it', async () => {
      const above = await giveBack(tokens.manager, {
        saleId: sale.id,
        items: [item('WTR-1L', 1, 'damaged', { unitPricePaisa: 2501 })],
      }).expect(422);
      expect(above.body.error.code).toBe('PRICE_ABOVE_SALE');
      const lower = await giveBack(tokens.manager, {
        saleId: sale.id,
        items: [item('WTR-1L', 1, 'damaged', { unitPricePaisa: 2000 })],
      }).expect(201);
      expect(lower.body.totalPaisa).toBe(2000);
    });

    it('without a sale, uses the current price (or carton price); managers may override', async () => {
      const res = await giveBack(tokens.salesman1, {
        items: [item('WTR-1L', 2), item('NDL-70', 1, 'damaged', {}, 'carton')],
      }).expect(201);
      expect(res.body.totalPaisa).toBe(2 * 2500 + 57_000);
      expect(res.body.saleId).toBeNull();

      const priced = await giveBack(tokens.owner, {
        items: [item('WTR-1L', 2, 'damaged', { unitPricePaisa: 1000 })],
      }).expect(201);
      expect(priced.body.totalPaisa).toBe(2000);

      const salesmanPrice = await giveBack(tokens.salesman1, {
        items: [item('WTR-1L', 2, 'damaged', { unitPricePaisa: 1 })],
      }).expect(403);
      expect(salesmanPrice.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('checks the sale: same shop, not cancelled', async () => {
      const otherShop = await as(tokens.manager)
        .post(RETURNS, {
          clientId: shops[1].id,
          saleId: sale.id,
          items: [item('WTR-1L', 1)],
        })
        .expect(422);
      expect(otherShop.body.error.code).toBe('SALE_MISMATCH');

      await as(tokens.manager)
        .post(`/api/v1/sales/${sale.id}/cancel`, { reason: 'x' })
        .expect(200);
      const cancelled = await giveBack(tokens.manager, {
        saleId: sale.id,
        items: [item('WTR-1L', 1)],
      }).expect(409);
      expect(cancelled.body.error.code).toBe('SALE_CANCELLED');
    });

    it('a sale with a return can no longer be cancelled', async () => {
      await giveBack(tokens.salesman1, {
        saleId: sale.id,
        items: [item('WTR-1L', 1)],
      }).expect(201);
      const res = await as(tokens.manager)
        .post(`/api/v1/sales/${sale.id}/cancel`, { reason: 'x' })
        .expect(409);
      expect(res.body.error.code).toBe('SALE_HAS_RETURN');
    });

    it('salesmen need their running day; managers need no plan', async () => {
      const res = await giveBack(tokens.salesman2, {
        items: [item('WTR-1L', 1)],
      }).expect(409);
      expect(res.body.error.code).toBe('NO_DAY_IN_PROGRESS');
      const office = await giveBack(tokens.manager, {
        items: [item('WTR-1L', 1)],
      }).expect(201);
      expect(office.body.dayPlanId).toBeNull();
    });

    it('lists: salesmen see theirs; any staff sees a shop’s returns', async () => {
      const mine = (
        await giveBack(tokens.salesman1, { items: [item('WTR-1L', 1)] })
      ).body;
      const office = (
        await giveBack(tokens.manager, { items: [item('NDL-70', 1)] })
      ).body;
      const ids = (r: request.Response) =>
        r.body.data.map((x: { id: string }) => x.id);

      expect(ids(await as(tokens.salesman1).get(RETURNS))).toEqual([mine.id]);
      await as(tokens.salesman1).get(`${RETURNS}/${office.id}`).expect(404);
      expect((await as(tokens.manager).get(RETURNS)).body.total).toBe(2);
      const forShop = await as(tokens.salesman2)
        .get(`/api/v1/clients/${shops[0].id}/returns`)
        .expect(200);
      expect(forShop.body.total).toBe(2);
      await as(tokens.bOwner)
        .get(`/api/v1/clients/${shops[0].id}/returns`)
        .expect(404);
      await as(tokens.bOwner).get(`${RETURNS}/${mine.id}`).expect(404);
    });
  });

  describe('write-offs', () => {
    it('a write-off with a day plan does not touch warehouse stock', async () => {
      const before = await warehouse();
      const res = await writeOff(tokens.manager, {
        dayPlanId: planId,
        unit: 'carton',
        quantity: 1,
        reason: 'expired',
        note: 'Past date',
      }).expect(201);
      expect(res.body).toMatchObject({
        dayPlanId: planId,
        unit: 'carton',
        quantity: 1,
        reason: 'expired',
        costValuePaisa: 1700 * 30,
        writeOffDate: nepalToday(),
        recordedBy: { id: staff.manager.id },
      });
      expect(await warehouse()).toEqual(before);
      // It shows on the plan's report.
      const report = await as(tokens.manager).get(`${PLANS}/${planId}/report`);
      const ndl = report.body.products.find(
        (x: { product: { sku: string } }) => x.product.sku === 'NDL-70',
      );
      expect(ndl.writtenOff).toBe(30);
    });

    it('a write-off without one reduces warehouse stock, at cost', async () => {
      const before = await warehouse();
      const res = await writeOff(tokens.manager, {
        productId: p['WTR-1L'].id,
        unit: 'carton',
        quantity: 2,
      }).expect(201);
      expect(res.body).toMatchObject({
        dayPlanId: null,
        costValuePaisa: 1800 * 24,
      });
      expect(await warehouse()).toEqual({
        ...before,
        'WTR-1L': before['WTR-1L'] - 24,
      });
    });

    it('without a plan, refuses to write off more than the warehouse holds', async () => {
      await db
        .update(products)
        .set({ stockQuantity: 5 })
        .where(eq(products.id, p['WTR-1L'].id));
      const res = await writeOff(tokens.manager, {
        productId: p['WTR-1L'].id,
        quantity: 6,
      }).expect(409);
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
      expect((await warehouse())['WTR-1L']).toBe(5);
      expect(await db.select().from(stockWriteOffs)).toHaveLength(0);
    });

    it('on a plan, cannot write off more than is left in the van, nor what was not issued', async () => {
      // NDL: 80 issued, 40 sold: 40 left.
      const over = await writeOff(tokens.manager, {
        dayPlanId: planId,
        quantity: 41,
      }).expect(409);
      expect(over.body.error).toMatchObject({
        code: 'INSUFFICIENT_PLAN_STOCK',
        details: [{ requested: 41, available: 40 }],
      });
      const notIssued = await writeOff(tokens.manager, {
        dayPlanId: planId,
        productId: p['BSC-100'].id,
      }).expect(422);
      expect(notIssued.body.error.code).toBe('PRODUCT_NOT_ON_PLAN');
    });

    it('written-off van stock can no longer be sold', async () => {
      // WTR: 24 issued, 4 sold: 20 left. Write off 18.
      await writeOff(tokens.salesman1, {
        productId: p['WTR-1L'].id,
        quantity: 18,
      }).expect(201);
      const res = await as(tokens.salesman1)
        .post(
          '/api/v1/sales',
          {
            clientId: shops[1].id,
            items: [{ productId: p['WTR-1L'].id, unit: 'base', quantity: 3 }],
          },
          { 'Idempotency-Key': `sale-${randomUUID()}` },
        )
        .expect(409);
      expect(res.body.error.details[0]).toMatchObject({
        requested: 3,
        available: 2,
      });
    });

    it('a salesman writes off only on his own running plan, and never sees cost', async () => {
      const own = await writeOff(tokens.salesman1, {}).expect(201);
      expect(own.body.dayPlanId).toBe(planId);
      expect(own.body.costValuePaisa).toBeUndefined();

      const none = await writeOff(tokens.salesman2, {}).expect(409);
      expect(none.body.error.code).toBe('NO_DAY_IN_PROGRESS');
      await writeOff(tokens.salesman2, { dayPlanId: planId }).expect(404);

      const list = await as(tokens.salesman1).get(WRITE_OFFS).expect(200);
      expect(list.text).not.toMatch(/costValue/);
    });

    it('cannot write off against a reconciled plan', async () => {
      await db
        .update(dayPlans)
        .set({ status: 'reconciled' })
        .where(eq(dayPlans.id, planId));
      const res = await writeOff(tokens.manager, { dayPlanId: planId }).expect(
        409,
      );
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
    });

    it('lists with filters, within the business', async () => {
      await writeOff(tokens.manager, { dayPlanId: planId });
      await writeOff(tokens.manager, {
        productId: p['WTR-1L'].id,
        reason: 'expired',
      });
      const q = (s: string) => as(tokens.manager).get(`${WRITE_OFFS}?${s}`);
      expect((await q('')).body.total).toBe(2);
      expect((await q(`dayPlanId=${planId}`)).body.total).toBe(1);
      expect((await q('reason=expired')).body.total).toBe(1);
      expect((await q(`productId=${p['WTR-1L'].id}`)).body.total).toBe(1);
      expect(
        (await q(`from=${nepalToday()}&to=${nepalToday()}`)).body.total,
      ).toBe(2);
      expect((await q('to=2020-01-01')).body.total).toBe(0);
      expect((await as(tokens.bOwner).get(WRITE_OFFS)).body.total).toBe(0);
    });
  });
});
