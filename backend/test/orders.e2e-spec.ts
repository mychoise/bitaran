import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  orders,
  products,
  retailClients,
  routeClients,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { shopToken, staffToken } from './utils/auth.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Product = typeof products.$inferSelect;
type Client = typeof retailClients.$inferSelect;

const A = '/api/v1';

describe('Orders taken by the office, delivered by a salesman (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>;
  let shops: Client[];
  let planId: string;
  const tokens = {} as Record<
    'owner' | 'manager' | 'salesman1' | 'salesman2' | 'shop',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object, headers: Record<string, string> = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).set(headers).send(body),
  });
  const line = (sku: string, quantity: number, unit = 'base') => ({
    productId: p[sku].id,
    unit,
    quantity,
  });
  const order = (extra: object = {}) =>
    as(tokens.manager).post(`${A}/orders`, {
      clientId: shops[0].id,
      salesmanId: staff.salesman1.id,
      items: [line('WTR-1L', 4), line('NDL-70', 1, 'carton')],
      paymentMode: 'on_delivery',
      note: 'Phoned in by the owner',
      ...extra,
    });
  const deliver = (token: string, orderId: string, extra: object = {}) =>
    as(token).post(
      `${A}/sales`,
      {
        clientId: shops[0].id,
        orderId,
        items: [line('WTR-1L', 4), line('NDL-70', 1, 'carton')],
        ...extra,
      },
      { 'Idempotency-Key': randomUUID() },
    );

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
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
    tokens.shop = await shopToken(app, shops[0]);
    planId = (
      await as(tokens.manager)
        .post(`${A}/day-plans`, {
          salesmanId: staff.salesman1.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock: [line('NDL-70', 2, 'carton'), line('WTR-1L', 20)],
        })
        .expect(201)
    ).body.id;
    await as(tokens.salesman1)
      .post(`${A}/day-plans/${planId}/start`, {})
      .expect(200);
  });

  it('a manager takes an order; it lists its lines with today’s prices', async () => {
    const res = await order().expect(201);
    expect(res.body).toMatchObject({
      status: 'open',
      paymentMode: 'on_delivery',
      note: 'Phoned in by the owner',
      client: { id: shops[0].id },
      salesman: { id: staff.salesman1.id },
      takenBy: { id: staff.manager.id },
      saleId: null,
    });
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: p['WTR-1L'].name,
          unit: 'base',
          quantity: 4,
          unitPricePaisa: p['WTR-1L'].pricePaisa,
        }),
        expect.objectContaining({
          unit: 'carton',
          unitPricePaisa: p['NDL-70'].cartonPricePaisa,
        }),
      ]),
    );
  });

  it('only owners and managers take or cancel orders', async () => {
    await as(tokens.salesman1)
      .post(`${A}/orders`, {
        clientId: shops[0].id,
        salesmanId: staff.salesman1.id,
        items: [line('WTR-1L', 1)],
        paymentMode: 'on_delivery',
      })
      .expect(403);
    const id = (await order().expect(201)).body.id;
    await as(tokens.salesman1)
      .post(`${A}/orders/${id}/cancel`, { reason: 'x' })
      .expect(403);
    await as(tokens.shop).get(`${A}/orders`).expect(403);
  });

  it('a salesman sees only the orders he delivers', async () => {
    await order().expect(201);
    await order({ salesmanId: staff.salesman2.id }).expect(201);
    const mine = await as(tokens.salesman1).get(`${A}/orders`).expect(200);
    expect(mine.body.total).toBe(1);
    const all = await as(tokens.manager).get(`${A}/orders`).expect(200);
    expect(all.body.total).toBe(2);
  });

  it('delivering is a sale with the order id; the order becomes delivered', async () => {
    const id = (await order().expect(201)).body.id;
    const sale = await deliver(tokens.salesman1, id, {
      cashPaidNowPaisa: 1000,
    }).expect(201);
    const after = await as(tokens.manager).get(`${A}/orders/${id}`).expect(200);
    expect(after.body).toMatchObject({
      status: 'delivered',
      saleId: sale.body.id,
      invoiceNumber: sale.body.invoiceNumber,
    });
    // Once delivered it cannot be delivered again or cancelled.
    expect((await deliver(tokens.salesman1, id)).status).toBe(409);
    await as(tokens.manager)
      .post(`${A}/orders/${id}/cancel`, { reason: 'late' })
      .expect(409);
  });

  it('only the assigned salesman delivers, and only to that shop', async () => {
    const id = (await order({ salesmanId: staff.salesman2.id })).body.id;
    expect((await deliver(tokens.salesman1, id)).status).toBe(403);
    const mine = (await order().expect(201)).body.id;
    const wrongShop = await deliver(tokens.salesman1, mine, {
      clientId: shops[1].id,
    });
    expect(wrongShop.status).toBe(422);
    // Nothing was delivered by the failed attempts.
    const rows = await db.select().from(orders);
    expect(rows.every((r) => r.status === 'open')).toBe(true);
  });

  it('a cancelled order cannot be delivered', async () => {
    const id = (await order().expect(201)).body.id;
    await as(tokens.manager)
      .post(`${A}/orders/${id}/cancel`, { reason: 'Shop changed its mind' })
      .expect(201);
    expect((await deliver(tokens.salesman1, id)).status).toBe(409);
  });

  it('a prepaid order carries the payment the office took', async () => {
    const pay = await as(tokens.manager)
      .post(
        `${A}/payments`,
        { clientId: shops[0].id, method: 'cash', amountPaisa: 5000 },
        { 'Idempotency-Key': randomUUID() },
      )
      .expect(201);
    const res = await order({
      paymentMode: 'prepaid',
      prepaidPaymentId: pay.body.id,
    }).expect(201);
    expect(res.body).toMatchObject({
      paymentMode: 'prepaid',
      prepaidPaymentId: pay.body.id,
      prepaidPaisa: 5000,
      prepaidMethod: 'cash',
    });
    await order({ paymentMode: 'prepaid' }).expect(422); // no payment
    await order({ prepaidPaymentId: pay.body.id }).expect(422); // on delivery
    await order({
      paymentMode: 'prepaid',
      prepaidPaymentId: pay.body.id,
      clientId: shops[1].id,
    }).expect(422); // another shop's payment
  });

  it('refuses unknown products, repeated lines and a non-salesman', async () => {
    await order({ items: [line('WTR-1L', 1), line('WTR-1L', 2)] }).expect(422);
    await order({
      items: [{ productId: randomUUID(), unit: 'base', quantity: 1 }],
    }).expect(422);
    await order({ salesmanId: staff.manager.id }).expect(422);
    await order({ items: [] }).expect(400);
  });
});
