import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import { products, users } from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import { StorageService } from '../src/storage/storage.service.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

const A = '/api/v1';

/**
 * One whole working day, only through the API and real logins, on the seed
 * data. Seeded prices (paisa): noodles 2,000 a piece / 57,000 a carton of 30;
 * biscuits 1,500 a piece. Warehouse: 3,000 noodles, 4,800 biscuits.
 */
describe('A full working day (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: MemoryStorage;
  let seeded: SeedResult;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    storage = app.get(StorageService);
    await truncateAll(db);
    storage.files.clear();
    seeded = await seed(db);
  });
  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}, headers = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).set(headers).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  const login = async (type: 'staff' | 'shop', email: string) => {
    const { password } = seeded.logins.find((l) => l.email === email)!;
    const res = await http()
      .post(`${A}/auth/${type}/login`)
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  };
  const stockOf = async (token: string, id: string) =>
    (await as(token).get(`${A}/products/${id}`).expect(200)).body
      .stockQuantity as number;

  it('runs from plan to reconciliation', async () => {
    const today = nepalToday();
    const manager = await login('staff', 'manager@asva.test');
    const salesman = await login('staff', 'salesman1@asva.test');
    const shopToken = await login('shop', 'shop1@asva.test');
    const [suman] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'salesman1@asva.test'));
    const bySku = async (sku: string) =>
      (await db.select().from(products).where(eq(products.sku, sku)))[0];
    const noodles = await bySku('NDL-70');
    const biscuits = await bySku('BSC-100');

    // ----- 1. The manager plans the day and issues stock -----
    const plan = await as(manager)
      .post(`${A}/day-plans`, {
        salesmanId: suman.id,
        routeId: seeded.routeId,
        planDate: today,
        stock: [
          { productId: noodles.id, unit: 'carton', quantity: 2 }, // 60
          { productId: biscuits.id, unit: 'base', quantity: 40 },
        ],
      })
      .expect(201);
    const planId: string = plan.body.id;
    expect(plan.body.visits).toHaveLength(3); // the route's three shops
    expect(await stockOf(manager, noodles.id)).toBe(3000 - 60);
    expect(await stockOf(manager, biscuits.id)).toBe(4800 - 40);

    // ----- 2. The salesman starts it and visits the first shop -----
    await as(salesman).post(`${A}/day-plans/${planId}/start`).expect(200);
    const today_ = await as(salesman).get(`${A}/day-plans/today`).expect(200);
    expect(today_.body.map((p: { id: string }) => p.id)).toContain(planId);
    const [kalimati, balkhu, kuleshwor] = plan.body.visits as {
      id: string;
      client: { id: string; name: string };
    }[];
    expect(kalimati.client.name).toBe('Kalimati Kirana Pasal');
    const shopId = kalimati.client.id;
    await as(salesman)
      .patch(`${A}/visits/${kalimati.id}`, {
        status: 'visited',
        lat: 27.6985,
        lng: 85.2961,
      })
      .expect(200);

    // ----- 3. Two sales: one on credit, one paid in cash -----
    const credit = await as(salesman)
      .post(
        `${A}/sales`,
        {
          clientId: shopId,
          visitId: kalimati.id,
          dueDate: nepalDate(7),
          items: [
            { productId: noodles.id, unit: 'carton', quantity: 1 }, // 57,000
            { productId: biscuits.id, unit: 'base', quantity: 10 }, // 15,000
          ],
        },
        { 'Idempotency-Key': randomUUID() },
      )
      .expect(201);
    expect(credit.body.totalPaisa).toBe(72_000);
    const cash = await as(salesman)
      .post(
        `${A}/sales`,
        {
          clientId: shopId,
          visitId: kalimati.id,
          cashPaidNowPaisa: 10_000,
          items: [{ productId: noodles.id, unit: 'base', quantity: 5 }],
        },
        { 'Idempotency-Key': randomUUID() },
      )
      .expect(201);
    expect(cash.body.totalPaisa).toBe(10_000);
    expect(cash.body.payments).toEqual([
      expect.objectContaining({
        method: 'cash',
        status: 'confirmed',
        amountPaisa: 10_000,
      }),
    ]);

    // ----- 4. A cheque, with a photo of it -----
    const cheque = await http()
      .post(`${A}/payments`)
      .auth(salesman, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .field('clientId', shopId)
      .field('method', 'cheque')
      .field('amountPaisa', '50000')
      .field('chequeNumber', 'NIC-000123')
      .field('chequeBank', 'NIC Asia')
      .attach('cheque_front', await photo(), {
        filename: 'cheque.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(cheque.body).toMatchObject({
      status: 'pending',
      amountPaisa: 50_000,
    });
    expect(cheque.body.images).toHaveLength(1);
    expect(storage.files.has(cheque.body.images[0].imageKey)).toBe(true);

    // ----- 5. Two biscuits came back damaged, against the credit sale -----
    const ret = await as(salesman)
      .post(`${A}/returns`, {
        clientId: shopId,
        saleId: credit.body.id,
        items: [
          {
            productId: biscuits.id,
            unit: 'base',
            quantity: 2,
            reason: 'damaged',
          },
        ],
      })
      .expect(201);
    expect(ret.body.totalPaisa).toBe(3_000); // at the sale's price
    // Damaged goods are not restocked.
    expect(await stockOf(manager, biscuits.id)).toBe(4800 - 40);

    // ----- 6. The other shops are skipped; the salesman closes -----
    for (const v of [balkhu, kuleshwor]) {
      await as(salesman)
        .patch(`${A}/visits/${v.id}`, { status: 'skipped' })
        .expect(200);
    }
    // Noodles: 60 issued, 30 + 5 sold, so 25 should be back: he reports 24
    // loose pieces (the cartons were opened). Biscuits: 40 - 10 = 30.
    await as(salesman)
      .post(`${A}/day-plans/${planId}/close`, {
        cashHandedOverPaisa: 10_000,
        returned: [
          { productId: noodles.id, unit: 'carton', quantityReturned: 0 },
          { productId: noodles.id, unit: 'base', quantityReturned: 24 },
          { productId: biscuits.id, unit: 'base', quantityReturned: 30 },
        ],
      })
      .expect(200);

    // ----- 7. The manager counts 23 noodles and reconciles -----
    await as(manager)
      .post(`${A}/day-plans/${planId}/reconcile`, {
        counted: [
          { productId: noodles.id, unit: 'carton', quantityCounted: 0 },
          { productId: noodles.id, unit: 'base', quantityCounted: 23 },
          { productId: biscuits.id, unit: 'base', quantityCounted: 30 },
        ],
        note: 'One packet of noodles missing',
      })
      .expect(200);

    // ----- The shortage report -----
    const report = await as(manager)
      .get(`${A}/day-plans/${planId}/report`)
      .expect(200);
    expect(report.body.status).toBe('reconciled');
    const line = (id: string) =>
      report.body.products.find(
        (p: { product: { id: string } }) => p.product.id === id,
      );
    expect(line(noodles.id)).toMatchObject({
      issued: 60,
      sold: 35,
      returned: 24,
      counted: 23,
      writtenOff: 0,
      shortage: 2, // 60 - 35 - 23
    });
    expect(line(biscuits.id)).toMatchObject({
      issued: 40,
      sold: 10,
      returned: 30,
      counted: 30,
      writtenOff: 0,
      shortage: 0,
    });
    expect(report.body.cash).toEqual({
      expectedPaisa: 10_000, // the cash sale; cheques are not cash
      handedOverPaisa: 10_000,
      differencePaisa: 0,
    });

    // ----- Stock: what was counted went back to the warehouse -----
    expect(await stockOf(manager, noodles.id)).toBe(3000 - 60 + 23);
    expect(await stockOf(manager, biscuits.id)).toBe(4800 - 40 + 30);

    // ----- The shop's balance -----
    // 72,000 + 10,000 sold - 10,000 cash - 3,000 returned. The cheque has
    // not cleared, so it is in clearing, not off the balance.
    const balance = await as(manager)
      .get(`${A}/clients/${shopId}/balance`)
      .expect(200);
    expect(balance.body).toMatchObject({
      totalSalesPaisa: 82_000,
      totalPaymentsPaisa: 10_000,
      totalReturnsPaisa: 3_000,
      balancePaisa: 69_000,
      inClearingPaisa: 50_000,
      overduePaisa: 0, // due in a week
    });
    const own = await as(shopToken).get(`${A}/shop/me/balance`).expect(200);
    expect(own.body.balancePaisa).toBe(69_000);

    // The cheque clears.
    await as(manager)
      .patch(`${A}/payments/${cheque.body.id}/status`, { status: 'confirmed' })
      .expect(200);
    const cleared = await as(shopToken).get(`${A}/shop/me/balance`);
    expect(cleared.body).toMatchObject({
      balancePaisa: 19_000,
      inClearingPaisa: 0,
    });
  });
});

function nepalDate(days: number): string {
  const d = new Date(`${nepalToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A distinct small JPEG each call. */
function photo() {
  return sharp(randomBytes(32 * 24 * 3), {
    raw: { width: 32, height: 24, channels: 3 },
  })
    .jpeg()
    .toBuffer();
}
