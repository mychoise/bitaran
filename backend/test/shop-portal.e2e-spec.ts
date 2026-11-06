import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  payments,
  retailClients,
  saleItems,
  saleReturnItems,
  saleReturns,
} from '../src/database/schema/index.js';
import { shopToken, staffToken } from './utils/auth.js';
import {
  insertProduct,
  insertSale,
  insertSalesContext,
} from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

const ME = '/api/v1/shop/me';

describe('Shop portal: own invoices, payments and returns (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let ctx: Awaited<ReturnType<typeof insertSalesContext>>;
  let otherShopId: string;
  let saleId: string;
  let otherSaleId: string;
  let shop: string;
  let other: string;
  let manager: string;

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
    ctx = await insertSalesContext(db);
    const product = await insertProduct(db, ctx.business.id, {
      name: 'Tea 500g',
      unit: 'packet',
      costPricePaisa: 700,
    });
    const sale = await insertSale(db, ctx, 1);
    saleId = sale.id;
    await db.insert(saleItems).values({
      id: randomUUID(),
      saleId,
      productId: product.id,
      productName: 'Tea 500g',
      unit: 'base',
      quantity: 10,
      unitPricePaisa: 1000,
      lineTotalPaisa: 10_000,
    });

    // A second shop in the same business, with its own sale.
    otherShopId = randomUUID();
    await db.insert(retailClients).values({
      id: otherShopId,
      businessId: ctx.business.id,
      name: 'Other shop',
      email: `${otherShopId}@test.local`,
      passwordHash: 'x',
      createdAt: new Date(),
    });
    otherSaleId = (
      await insertSale(db, { ...ctx, client: { id: otherShopId } as never }, 2)
    ).id;

    const pay = (
      status: 'confirmed' | 'pending' | 'bounced',
      amountPaisa: number,
      method: 'cash' | 'cheque' = 'cash',
    ) => ({
      id: randomUUID(),
      businessId: ctx.business.id,
      clientId: ctx.client.id,
      saleId,
      dayPlanId: ctx.dayPlan.id,
      collectedBy: ctx.salesman.id,
      method,
      status,
      amountPaisa,
      chequeNumber: method === 'cheque' ? '000123' : null,
      receivedAt: new Date(),
      createdAt: new Date(),
    });
    await db
      .insert(payments)
      .values([
        pay('confirmed', 4000),
        pay('pending', 3000, 'cheque'),
        pay('bounced', 2000, 'cheque'),
      ]);

    const returnId = randomUUID();
    await db.insert(saleReturns).values({
      id: returnId,
      businessId: ctx.business.id,
      clientId: ctx.client.id,
      receivedBy: ctx.salesman.id,
      returnDate: nepalToday(),
      totalPaisa: 1000,
      createdAt: new Date(),
    });
    await db.insert(saleReturnItems).values({
      id: randomUUID(),
      saleReturnId: returnId,
      productId: product.id,
      productName: 'Tea 500g',
      unit: 'base',
      quantity: 1,
      unitPricePaisa: 1000,
      lineTotalPaisa: 1000,
      reason: 'damaged',
      restocked: false,
    });

    shop = await shopToken(app, ctx.client);
    other = await shopToken(app, { id: otherShopId });
    manager = await staffToken(app, ctx.manager);
  });

  it('lists only the shop’s own invoices, with what was paid on each', async () => {
    const res = await get(shop, `${ME}/invoices`).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: saleId,
      invoiceNumber: 1,
      totalPaisa: 10_000,
      paidPaisa: 4000,
      status: 'confirmed',
      salesman: { fullName: expect.any(String) },
    });
    const mine = await get(other, `${ME}/invoices`).expect(200);
    expect(mine.body.data.map((s: { id: string }) => s.id)).toEqual([
      otherSaleId,
    ]);
  });

  it('filters invoices by status and dates', async () => {
    const none = await get(shop, `${ME}/invoices?status=cancelled`).expect(200);
    expect(none.body.total).toBe(0);
    const later = await get(shop, `${ME}/invoices?from=2999-01-01`).expect(200);
    expect(later.body.total).toBe(0);
  });

  it('shows one invoice with its lines and payments, never cost or staff ids', async () => {
    const res = await get(shop, `${ME}/invoices/${saleId}`).expect(200);
    expect(res.body.items).toEqual([
      {
        productName: 'Tea 500g',
        baseUnit: 'packet',
        unit: 'base',
        quantity: 10,
        unitPricePaisa: 1000,
        lineTotalPaisa: 10_000,
      },
    ]);
    expect(res.body.payments).toHaveLength(3);
    expect(res.body.subtotalPaisa).toBe(10_000);
    expect(res.text).not.toMatch(/cost/i);
    expect(res.text).not.toContain(ctx.salesman.id);
    expect(res.text).not.toContain(ctx.dayPlan.id);
  });

  it('answers another shop’s invoice as not found', async () => {
    await get(shop, `${ME}/invoices/${otherSaleId}`).expect(404);
    await get(shop, `${ME}/invoices/${randomUUID()}`).expect(404);
  });

  it('lists every payment, pending and bounced ones too, and filters by status', async () => {
    const all = await get(shop, `${ME}/payments`).expect(200);
    expect(all.body.total).toBe(3);
    expect(
      all.body.data.map((p: { status: string }) => p.status).sort(),
    ).toEqual(['bounced', 'confirmed', 'pending']);
    expect(all.body.data[0]).toMatchObject({ invoiceNumber: 1, saleId });
    expect(all.text).not.toContain(ctx.salesman.id);
    const pending = await get(shop, `${ME}/payments?status=pending`).expect(
      200,
    );
    expect(pending.body.data).toEqual([
      expect.objectContaining({
        status: 'pending',
        method: 'cheque',
        chequeNumber: '000123',
        amountPaisa: 3000,
      }),
    ]);
    const others = await get(other, `${ME}/payments`).expect(200);
    expect(others.body.total).toBe(0);
  });

  it('lists returns with their lines', async () => {
    const res = await get(shop, `${ME}/returns`).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      totalPaisa: 1000,
      items: [
        {
          productName: 'Tea 500g',
          baseUnit: 'packet',
          unit: 'base',
          quantity: 1,
          reason: 'damaged',
          lineTotalPaisa: 1000,
        },
      ],
    });
    const others = await get(other, `${ME}/returns`).expect(200);
    expect(others.body.total).toBe(0);
  });

  it('is for shops only', async () => {
    for (const url of [
      `${ME}/invoices`,
      `${ME}/invoices/${saleId}`,
      `${ME}/payments`,
      `${ME}/returns`,
    ]) {
      await get(manager, url).expect(403);
      await request(app.getHttpServer()).get(url).expect(401);
    }
  });
});
