import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  dayPlanStock,
  payments,
  products,
  retailClients,
  routes,
  saleItems,
  saleReturns,
  sales,
  stockWriteOffs,
  users,
} from '../src/database/schema/index.js';
import { shopToken, staffToken } from './utils/auth.js';
import {
  insertBusiness,
  insertProduct,
  insertSale,
  insertSalesContext,
  insertUser,
} from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Product = typeof products.$inferSelect;
type Client = typeof retailClients.$inferSelect;
type PlanStatus = (typeof dayPlans.$inferSelect)['status'];

const REPORTS = '/api/v1/reports';

function nepalDate(days: number): string {
  const d = new Date(`${nepalToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** A moment on a Nepal date, e.g. at(D1, '09:10'). */
const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:45`);

const TODAY = nepalToday();
const D1 = nepalDate(-3);
const D2 = nepalDate(-2);
const D3 = nepalDate(-1);

/**
 * One business, worked by hand. Prices are per base unit; P1 comes in
 * cartons of 10. Every figure the tests expect is derived in comments here
 * or beside the assertion.
 *
 * Salesman S1 (Asha):
 *   plan1, D1, reconciled. Issued P1 3 cartons (30), P2 10. Counted P1 1
 *     carton (10), P2 4. Written off P2 1.
 *     sale #1 Alpha 1000 (P1 5x100 + P2 2x250), due D2
 *     sale #2 Bravo  900 (P1 1 carton = 10 base, at 900), no due date
 *     sale #3 Alpha  250 (P2 1), CANCELLED
 *     pay Alpha cash 400; Bravo cheque 300 pending; Bravo online 100 bounced
 *     return Alpha 200
 *     shortage P1 30-15-10-0 = 5 (x100 = 500); P2 10-2-4-1 = 3 (x250 = 750)
 *   plan2, D2, closed. Issued P1 5, P2 3. Returned P1 5, P2 1.
 *     sale #4 Charlie 100 (P1 1), due D2
 *     pay Alpha cash 100 at 00:30 on D3 (the plan ran past midnight)
 *     shortage P1 5-1-5 = -1 (a surplus: counts as 0); P2 3-0-1 = 2 (500)
 *   plan3, today, in progress (no shortage yet).
 *     sale #5 Alpha 600 (P1 6), due in a week
 *     pay Alpha cash 250; Charlie cash 50; Alpha cheque 1000 pending
 *
 * Salesman S2 (Bikash):
 *   plan5, today-10, reconciled: sale #7 Bravo 2000, due today-5
 *   plan4, today, in progress: sale #6 Bravo 700 (P2 2x350); pay Bravo cash 300
 *
 * Office (manager, no plan): Charlie cash 80 today.
 * Opening balances: Bravo 500 owed; Charlie 100 in credit.
 */
describe('Reports (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let businessId: string;
  let staff: Record<'owner' | 'manager' | 's1' | 's2', User>;
  let shop: Record<'alpha' | 'bravo' | 'charlie', Client>;
  let p: Record<'p1' | 'p2' | 'p3' | 'p4' | 'p5', Product>;
  let tokens: Record<'owner' | 'manager' | 's1' | 's2' | 'bManager', string>;
  let otherSalesman: User;

  const get = (token: string, url: string) =>
    request(app.getHttpServer()).get(url).auth(token, { type: 'bearer' });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(db);
    const business = await insertBusiness(db);
    businessId = business.id;
    staff = {
      owner: await insertUser(db, businessId, { role: 'owner' }),
      manager: await insertUser(db, businessId, { role: 'manager' }),
      s1: await insertUser(db, businessId, { fullName: 'Asha' }),
      s2: await insertUser(db, businessId, { fullName: 'Bikash' }),
    };
    const [route] = await db
      .insert(routes)
      .values({
        id: randomUUID(),
        businessId,
        name: 'Route',
        createdAt: new Date(),
      })
      .returning();
    const client = async (name: string, openingBalancePaisa = 0) => {
      const id = randomUUID();
      const [row] = await db
        .insert(retailClients)
        .values({
          id,
          businessId,
          name,
          phone: '98000',
          email: `${id}@test.local`,
          passwordHash: 'x',
          openingBalancePaisa,
          createdAt: new Date(),
        })
        .returning();
      return row;
    };
    shop = {
      alpha: await client('Alpha'),
      bravo: await client('Bravo', 500),
      charlie: await client('Charlie', -100),
    };
    p = {
      p1: await insertProduct(db, businessId, {
        name: 'Biscuit',
        pricePaisa: 100,
        unitsPerCarton: 10,
        stockQuantity: 50,
        lowStockAlert: 60,
      }),
      p2: await insertProduct(db, businessId, {
        name: 'Chiura',
        pricePaisa: 250,
        stockQuantity: 5,
        lowStockAlert: 5,
      }),
      p3: await insertProduct(db, businessId, {
        name: 'Dalmoth',
        stockQuantity: 100,
        lowStockAlert: 10,
      }),
      p4: await insertProduct(db, businessId, {
        name: 'Egg',
        stockQuantity: 0,
      }),
      p5: await insertProduct(db, businessId, {
        name: 'Fini (retired)',
        stockQuantity: 0,
        lowStockAlert: 10,
        isActive: false,
      }),
    };

    const plan = async (
      salesman: User,
      planDate: string,
      status: PlanStatus,
      stock: [
        Product,
        'base' | 'carton',
        number,
        number | null,
        number | null,
      ][] = [],
    ) => {
      const [row] = await db
        .insert(dayPlans)
        .values({
          id: randomUUID(),
          businessId,
          salesmanId: salesman.id,
          routeId: route.id,
          planDate,
          status,
          assignedBy: staff.manager.id,
          createdAt: new Date(),
        })
        .returning();
      for (const [product, unit, issued, returned, counted] of stock) {
        await db.insert(dayPlanStock).values({
          id: randomUUID(),
          dayPlanId: row.id,
          productId: product.id,
          unit,
          quantityIssued: issued,
          quantityReturned: returned,
          quantityCounted: counted,
        });
      }
      return row;
    };
    const sale = async (o: {
      plan: typeof dayPlans.$inferSelect;
      shop: Client;
      invoice: number;
      at: Date;
      dueDate?: string;
      status?: 'confirmed' | 'cancelled';
      items: [Product, 'base' | 'carton', number, number][];
    }) => {
      const id = randomUUID();
      const lines = o.items.map(([product, unit, quantity, price]) => ({
        id: randomUUID(),
        saleId: id,
        productId: product.id,
        productName: product.name,
        unit,
        quantity,
        unitPricePaisa: price,
        lineTotalPaisa: quantity * price,
      }));
      await db.insert(sales).values({
        id,
        businessId,
        clientId: o.shop.id,
        salesmanId: o.plan.salesmanId,
        dayPlanId: o.plan.id,
        invoiceNumber: o.invoice,
        saleDate: o.plan.planDate,
        dueDate: o.dueDate,
        totalPaisa: lines.reduce((n, l) => n + l.lineTotalPaisa, 0),
        status: o.status ?? 'confirmed',
        createdAt: o.at,
      });
      await db.insert(saleItems).values(lines);
    };
    const pay = (o: {
      shop: Client;
      plan?: typeof dayPlans.$inferSelect;
      by: User;
      method: 'cash' | 'cheque' | 'online';
      status?: 'confirmed' | 'pending' | 'bounced';
      amount: number;
      at: Date;
    }) =>
      db.insert(payments).values({
        id: randomUUID(),
        businessId,
        clientId: o.shop.id,
        dayPlanId: o.plan?.id,
        collectedBy: o.by.id,
        method: o.method,
        status: o.status ?? 'confirmed',
        amountPaisa: o.amount,
        receivedAt: o.at,
        chequeNumber: o.method === 'cheque' ? 'CHQ-1' : undefined,
        createdAt: o.at,
      });

    // ----- S1 -----
    const plan1 = await plan(staff.s1, D1, 'reconciled', [
      [p.p1, 'carton', 3, 1, 1],
      [p.p2, 'base', 10, 5, 4],
    ]);
    await sale({
      plan: plan1,
      shop: shop.alpha,
      invoice: 1,
      at: at(D1, '09:00'),
      dueDate: D2,
      items: [
        [p.p1, 'base', 5, 100],
        [p.p2, 'base', 2, 250],
      ],
    });
    await sale({
      plan: plan1,
      shop: shop.bravo,
      invoice: 2,
      at: at(D1, '09:10'),
      items: [[p.p1, 'carton', 1, 900]],
    });
    await sale({
      plan: plan1,
      shop: shop.alpha,
      invoice: 3,
      at: at(D1, '09:20'),
      status: 'cancelled',
      items: [[p.p2, 'base', 1, 250]],
    });
    await db.insert(stockWriteOffs).values({
      id: randomUUID(),
      businessId,
      productId: p.p2.id,
      unit: 'base',
      quantity: 1,
      reason: 'damaged',
      writeOffDate: D1,
      dayPlanId: plan1.id,
      recordedBy: staff.s1.id,
      createdAt: at(D1, '12:00'),
    });
    await pay({
      shop: shop.alpha,
      plan: plan1,
      by: staff.s1,
      method: 'cash',
      amount: 400,
      at: at(D1, '10:00'),
    });
    await pay({
      shop: shop.bravo,
      plan: plan1,
      by: staff.s1,
      method: 'cheque',
      status: 'pending',
      amount: 300,
      at: at(D1, '10:10'),
    });
    await pay({
      shop: shop.bravo,
      plan: plan1,
      by: staff.s1,
      method: 'online',
      status: 'bounced',
      amount: 100,
      at: at(D1, '10:20'),
    });
    await db.insert(saleReturns).values({
      id: randomUUID(),
      businessId,
      clientId: shop.alpha.id,
      dayPlanId: plan1.id,
      receivedBy: staff.s1.id,
      returnDate: D1,
      totalPaisa: 200,
      createdAt: at(D1, '11:00'),
    });

    const plan2 = await plan(staff.s1, D2, 'closed', [
      [p.p1, 'base', 5, 5, null],
      [p.p2, 'base', 3, 1, null],
    ]);
    await sale({
      plan: plan2,
      shop: shop.charlie,
      invoice: 4,
      at: at(D2, '09:00'),
      dueDate: D2,
      items: [[p.p1, 'base', 1, 100]],
    });
    // Received just after midnight in Nepal: still the day before in UTC.
    await pay({
      shop: shop.alpha,
      plan: plan2,
      by: staff.s1,
      method: 'cash',
      amount: 100,
      at: at(D3, '00:30'),
    });

    const plan3 = await plan(staff.s1, TODAY, 'in_progress', [
      [p.p1, 'base', 10, null, null],
    ]);
    await sale({
      plan: plan3,
      shop: shop.alpha,
      invoice: 5,
      at: at(TODAY, '09:00'),
      dueDate: nepalDate(7),
      items: [[p.p1, 'base', 6, 100]],
    });
    await pay({
      shop: shop.alpha,
      plan: plan3,
      by: staff.s1,
      method: 'cash',
      amount: 250,
      at: at(TODAY, '10:00'),
    });
    await pay({
      shop: shop.charlie,
      plan: plan3,
      by: staff.s1,
      method: 'cash',
      amount: 50,
      at: at(TODAY, '10:10'),
    });
    await pay({
      shop: shop.alpha,
      plan: plan3,
      by: staff.s1,
      method: 'cheque',
      status: 'pending',
      amount: 1000,
      at: at(TODAY, '10:20'),
    });

    // ----- S2 -----
    const plan5 = await plan(staff.s2, nepalDate(-10), 'reconciled');
    await sale({
      plan: plan5,
      shop: shop.bravo,
      invoice: 7,
      at: at(nepalDate(-10), '09:00'),
      dueDate: nepalDate(-5),
      items: [[p.p1, 'base', 20, 100]],
    });
    const plan4 = await plan(staff.s2, TODAY, 'in_progress');
    await sale({
      plan: plan4,
      shop: shop.bravo,
      invoice: 6,
      at: at(TODAY, '09:30'),
      items: [[p.p2, 'base', 2, 350]],
    });
    await pay({
      shop: shop.bravo,
      plan: plan4,
      by: staff.s2,
      method: 'cash',
      amount: 300,
      at: at(TODAY, '11:00'),
    });

    // ----- office -----
    await pay({
      shop: shop.charlie,
      by: staff.manager,
      method: 'cash',
      amount: 80,
      at: at(TODAY, '12:00'),
    });

    // ----- another business: overdue, low on stock, selling today -----
    const other = await insertSalesContext(db);
    otherSalesman = other.salesman;
    await insertSale(db, other, 1);
    await db
      .update(sales)
      .set({ dueDate: nepalDate(-1) })
      .where(eq(sales.businessId, other.business.id));
    await insertProduct(db, other.business.id, {
      stockQuantity: 0,
      lowStockAlert: 5,
    });

    tokens = {
      owner: await staffToken(app, staff.owner),
      manager: await staffToken(app, staff.manager),
      s1: await staffToken(app, staff.s1),
      s2: await staffToken(app, staff.s2),
      bManager: await staffToken(app, other.manager),
    };
  });

  describe('access', () => {
    const own = (id: () => string) => [
      `${REPORTS}/salesman/${id()}/history?from=${D1}&to=${TODAY}`,
      `${REPORTS}/salesman/${id()}/analytics?from=${D1}&to=${TODAY}`,
    ];

    it('never lets a salesman request another salesman’s report', async () => {
      for (const url of own(() => staff.s2.id)) {
        const res = await get(tokens.s1, url).expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
      for (const url of own(() => staff.s1.id)) {
        await get(tokens.s1, url).expect(200);
        await get(tokens.s2, url).expect(403);
        await get(tokens.manager, url).expect(200);
        await get(tokens.owner, url).expect(200);
      }
    });

    it('treats a salesman of another business as missing', async () => {
      for (const url of own(() => otherSalesman.id)) {
        const res = await get(tokens.manager, url).expect(404);
        expect(res.body.error.code).toBe('USER_NOT_FOUND');
      }
    });

    it('keeps the business-wide reports for managers and owners', async () => {
      for (const path of ['overdue-credit', 'low-stock']) {
        await get(tokens.s1, `${REPORTS}/${path}`).expect(403);
        await get(tokens.manager, `${REPORTS}/${path}`).expect(200);
        await get(tokens.owner, `${REPORTS}/${path}`).expect(200);
      }
    });

    it('is staff only', async () => {
      const shopT = await shopToken(app, shop.alpha);
      await get(shopT, `${REPORTS}/today`).expect(403);
      await request(app.getHttpServer()).get(`${REPORTS}/today`).expect(401);
    });

    it('validates ranges', async () => {
      const base = `${REPORTS}/salesman/${staff.s1.id}`;
      await get(tokens.s1, `${base}/history`).expect(400);
      await get(tokens.s1, `${base}/analytics?from=${D1}`).expect(400);
      const back = await get(
        tokens.s1,
        `${base}/history?from=${TODAY}&to=${D1}`,
      ).expect(400);
      expect(back.body.error.code).toBe('INVALID_DATE_RANGE');
      const long = await get(
        tokens.s1,
        `${base}/analytics?from=2025-01-01&to=2026-01-02`,
      ).expect(400);
      expect(long.body.error.code).toBe('DATE_RANGE_TOO_LONG');
      await get(
        tokens.s1,
        `${base}/analytics?from=2025-01-01&to=2026-01-01`,
      ).expect(200); // exactly 366 days
      await get(tokens.manager, `${REPORTS}/salesman/nope/history`).expect(400);
    });
  });

  describe('GET /reports/salesman/:id/history', () => {
    it('lists every sale and payment, newest first', async () => {
      const res = await get(
        tokens.s1,
        `${REPORTS}/salesman/${staff.s1.id}/history?from=${D1}&to=${TODAY}&limit=100`,
      ).expect(200);
      expect(res.body.salesman).toMatchObject({ id: staff.s1.id });
      expect(res.body.total).toBe(12); // 5 sales + 7 payments
      const rows = res.body.data as {
        kind: string;
        amountPaisa: number;
        status: string;
      }[];
      expect(rows.map((r) => [r.kind[0], r.amountPaisa, r.status])).toEqual([
        ['p', 1000, 'pending'], // today 10:20
        ['p', 50, 'confirmed'],
        ['p', 250, 'confirmed'],
        ['s', 600, 'confirmed'], // today 09:00
        ['p', 100, 'confirmed'], // D3 00:30
        ['s', 100, 'confirmed'], // D2
        ['p', 100, 'bounced'], // D1 10:20
        ['p', 300, 'pending'],
        ['p', 400, 'confirmed'],
        ['s', 250, 'cancelled'], // D1 09:20
        ['s', 900, 'confirmed'],
        ['s', 1000, 'confirmed'],
      ]);
      expect(res.body.data[3]).toMatchObject({
        kind: 'sale',
        date: TODAY,
        invoiceNumber: 5,
        shop: { id: shop.alpha.id, name: 'Alpha' },
      });
      expect(res.body.data[0]).toMatchObject({
        kind: 'payment',
        method: 'cheque',
        reference: 'CHQ-1',
        date: TODAY,
      });
    });

    it('pages and honours the range', async () => {
      const url = `${REPORTS}/salesman/${staff.s1.id}/history`;
      const page3 = await get(
        tokens.manager,
        `${url}?from=${D1}&to=${TODAY}&limit=4&page=3`,
      ).expect(200);
      expect(page3.body).toMatchObject({ total: 12, page: 3, limit: 4 });
      expect(
        page3.body.data.map((r: { amountPaisa: number }) => r.amountPaisa),
      ).toEqual([400, 250, 900, 1000]);
      const beyond = await get(
        tokens.manager,
        `${url}?from=${D1}&to=${TODAY}&page=9`,
      ).expect(200);
      expect(beyond.body).toMatchObject({ total: 12, data: [] });

      // Days are Nepal days: the 00:30 payment is D3's, not D2's.
      const d2 = await get(tokens.manager, `${url}?from=${D2}&to=${D2}`);
      expect(d2.body.total).toBe(1);
      expect(d2.body.data[0]).toMatchObject({ invoiceNumber: 4 });
      const d3 = await get(tokens.manager, `${url}?from=${D3}&to=${D3}`);
      expect(d3.body.total).toBe(1);
      expect(d3.body.data[0]).toMatchObject({
        kind: 'payment',
        amountPaisa: 100,
        date: D3,
      });
    });

    it('shows S2 only his own, never office payments', async () => {
      const res = await get(
        tokens.s2,
        `${REPORTS}/salesman/${staff.s2.id}/history?from=${nepalDate(-30)}&to=${TODAY}`,
      ).expect(200);
      expect(
        res.body.data.map((r: { amountPaisa: number }) => r.amountPaisa),
      ).toEqual([300, 700, 2000]);
    });
  });

  describe('GET /reports/today', () => {
    it('gives a salesman his own day', async () => {
      const res = await get(tokens.s1, `${REPORTS}/today`).expect(200);
      expect(res.body).toEqual({
        date: TODAY,
        salesCount: 1,
        salesPaisa: 600,
        cashCollectedPaisa: 300, // 250 + 50; the 1000 cheque is not cash
        shops: [
          {
            shop: { id: shop.alpha.id, name: 'Alpha' },
            salesCount: 1,
            salesPaisa: 600,
            cashCollectedPaisa: 250,
          },
          {
            shop: { id: shop.charlie.id, name: 'Charlie' },
            salesCount: 0,
            salesPaisa: 0,
            cashCollectedPaisa: 50,
          },
        ],
      });
    });

    it('gives managers the business, per shop and per salesman', async () => {
      const res = await get(tokens.manager, `${REPORTS}/today`).expect(200);
      expect(res.body).toEqual({
        date: TODAY,
        salesCount: 2,
        salesPaisa: 1300, // 600 + 700
        cashCollectedPaisa: 680, // 250 + 50 + 300 + 80 at the office
        shops: [
          {
            shop: { id: shop.alpha.id, name: 'Alpha' },
            salesCount: 1,
            salesPaisa: 600,
            cashCollectedPaisa: 250,
          },
          {
            shop: { id: shop.bravo.id, name: 'Bravo' },
            salesCount: 1,
            salesPaisa: 700,
            cashCollectedPaisa: 300,
          },
          {
            shop: { id: shop.charlie.id, name: 'Charlie' },
            salesCount: 0,
            salesPaisa: 0,
            cashCollectedPaisa: 130, // 50 + 80
          },
        ],
        salesmen: [
          {
            salesman: { id: staff.s1.id, fullName: 'Asha' },
            salesCount: 1,
            salesPaisa: 600,
            cashCollectedPaisa: 300,
          },
          {
            salesman: { id: staff.s2.id, fullName: 'Bikash' },
            salesCount: 1,
            salesPaisa: 700,
            cashCollectedPaisa: 300,
          },
          {
            salesman: null,
            salesCount: 0,
            salesPaisa: 0,
            cashCollectedPaisa: 80,
          },
        ],
      });
      const other = await get(tokens.bManager, `${REPORTS}/today`).expect(200);
      expect(other.body).toMatchObject({ salesCount: 1, salesPaisa: 10_000 });
    });
  });

  describe('GET /reports/salesman/:id/analytics', () => {
    it('matches the hand calculation', async () => {
      const res = await get(
        tokens.s1,
        `${REPORTS}/salesman/${staff.s1.id}/analytics?from=${D1}&to=${TODAY}`,
      ).expect(200);
      expect(res.body).toEqual({
        salesman: { id: staff.s1.id, fullName: 'Asha', role: 'salesman' },
        from: D1,
        to: TODAY,
        // #1 1000 + #2 900 + #4 100 + #5 600; #3 is cancelled
        sales: { count: 4, totalPaisa: 2600, averagePaisa: 650 },
        payments: {
          totalPaisa: 2100,
          byMethod: [
            { method: 'cash', count: 4, totalPaisa: 800, pendingPaisa: 0 },
            {
              method: 'cheque',
              count: 2,
              totalPaisa: 1300,
              pendingPaisa: 1300,
            },
            // the 100 transfer bounced
            { method: 'online', count: 0, totalPaisa: 0, pendingPaisa: 0 },
          ],
        },
        returns: { count: 1, totalPaisa: 200 },
        // plan1: P1 5 (500) + P2 3 (750); plan2: P2 2 (500), P1's surplus ignored
        shortage: { plans: 2, units: 10, valuePaisa: 1750 },
        days: [
          { date: D1, salesCount: 2, salesPaisa: 1900, collectedPaisa: 700 },
          { date: D2, salesCount: 1, salesPaisa: 100, collectedPaisa: 0 },
          { date: D3, salesCount: 0, salesPaisa: 0, collectedPaisa: 100 },
          { date: TODAY, salesCount: 1, salesPaisa: 600, collectedPaisa: 1300 },
        ],
        shops: [
          {
            shop: { id: shop.alpha.id, name: 'Alpha' },
            salesCount: 2,
            salesPaisa: 1600,
            collectedPaisa: 1750, // 400 + 100 + 250 + 1000
          },
          {
            shop: { id: shop.bravo.id, name: 'Bravo' },
            salesCount: 1,
            salesPaisa: 900,
            collectedPaisa: 300,
          },
          {
            shop: { id: shop.charlie.id, name: 'Charlie' },
            salesCount: 1,
            salesPaisa: 100,
            collectedPaisa: 50,
          },
        ],
        topProducts: [
          {
            product: { id: p.p1.id, name: 'Biscuit', sku: null, unit: 'piece' },
            quantity: 22, // 5 + 10 (a carton) + 1 + 6
            salesPaisa: 2100,
          },
          {
            product: { id: p.p2.id, name: 'Chiura', sku: null, unit: 'piece' },
            quantity: 2,
            salesPaisa: 500,
          },
        ],
      });
    });

    it('narrows to the range', async () => {
      const res = await get(
        tokens.manager,
        `${REPORTS}/salesman/${staff.s1.id}/analytics?from=${D2}&to=${D2}`,
      ).expect(200);
      expect(res.body).toMatchObject({
        sales: { count: 1, totalPaisa: 100, averagePaisa: 100 },
        payments: { totalPaisa: 0 },
        returns: { count: 0, totalPaisa: 0 },
        shortage: { plans: 1, units: 2, valuePaisa: 500 },
        days: [{ date: D2, salesCount: 1, salesPaisa: 100, collectedPaisa: 0 }],
      });
      const empty = await get(
        tokens.manager,
        `${REPORTS}/salesman/${staff.s1.id}/analytics?from=2020-01-01&to=2020-01-02`,
      ).expect(200);
      expect(empty.body).toMatchObject({
        sales: { count: 0, totalPaisa: 0, averagePaisa: 0 },
        shortage: { plans: 0, units: 0, valuePaisa: 0 },
        shops: [],
        topProducts: [],
      });
      expect(empty.body.days).toHaveLength(2);
    });
  });

  describe('GET /reports/overdue-credit', () => {
    it('lists shops with an overdue unpaid part, oldest first', async () => {
      const res = await get(tokens.manager, `${REPORTS}/overdue-credit`).expect(
        200,
      );
      expect(res.body).toEqual({
        asOf: TODAY,
        page: 1,
        limit: 20,
        total: 2,
        data: [
          {
            // Opening 500 owed, paid 300 (cash): nothing settles past the
            // opening, so #7 (2000, due today-5) is wholly unpaid.
            shop: { id: shop.bravo.id, name: 'Bravo', phone: '98000' },
            oldestDueDate: nepalDate(-5),
            daysOverdue: 5,
            overdueSales: 1,
            overduePaisa: 2000,
            balancePaisa: 3800, // 500 + 2000 + 900 + 700 - 300
            creditLimitPaisa: 0,
          },
          {
            // Paid 750 (cash only) + returned 200 = 950 against #1's 1000.
            shop: { id: shop.alpha.id, name: 'Alpha', phone: '98000' },
            oldestDueDate: D2,
            daysOverdue: 2,
            overdueSales: 1,
            overduePaisa: 50,
            balancePaisa: 650, // 1000 + 600 - 750 - 200
            creditLimitPaisa: 0,
          },
        ],
      });
      // Charlie: 100 credit + 130 paid covers #4's 100.
    });

    it('agrees with each shop’s balance summary', async () => {
      for (const s of Object.values(shop)) {
        const summary = await get(
          tokens.manager,
          `/api/v1/clients/${s.id}/balance`,
        ).expect(200);
        const report = await get(tokens.manager, `${REPORTS}/overdue-credit`);
        const row = report.body.data.find(
          (r: { shop: { id: string } }) => r.shop.id === s.id,
        );
        expect(row?.overduePaisa ?? 0).toBe(summary.body.overduePaisa);
        if (row) expect(row.balancePaisa).toBe(summary.body.balancePaisa);
      }
    });

    it('pages, and shows another business only its own', async () => {
      const page2 = await get(
        tokens.manager,
        `${REPORTS}/overdue-credit?limit=1&page=2`,
      ).expect(200);
      expect(page2.body.total).toBe(2);
      expect(
        page2.body.data.map((r: { shop: { name: string } }) => r.shop.name),
      ).toEqual(['Alpha']);
      const other = await get(tokens.bManager, `${REPORTS}/overdue-credit`);
      expect(other.body.total).toBe(1);
      expect(other.body.data[0].overduePaisa).toBe(10_000);
    });
  });

  describe('GET /reports/low-stock', () => {
    it('lists active products at or below their alert, emptiest first', async () => {
      const res = await get(tokens.owner, `${REPORTS}/low-stock`).expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          id: p.p1.id,
          stockQuantity: 50,
          lowStockAlert: 60,
        }),
        expect.objectContaining({
          id: p.p2.id,
          stockQuantity: 5,
          lowStockAlert: 5, // at the level counts
        }),
      ]);
      // Dalmoth is above its alert; Egg has none; Fini is inactive.
    });
  });
});
