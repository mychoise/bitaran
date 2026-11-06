import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { Database } from '../src/database/database.types.js';
import { products, users } from '../src/database/schema/index.js';
import { seedActivity } from '../src/database/seed/demo-activity.js';
import { seed } from '../src/database/seed/seed.js';
import { shopToken, staffToken } from './utils/auth.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

const A = '/api/v1';

describe('Demo seed: a week of activity that the API reads back consistently (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let owner: string;
  const files = new Map<string, Buffer>();

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await truncateAll(db);
    const base = await seed(db);
    await seedActivity(db, base, {
      storeImage: async (key, jpeg) => void files.set(key, jpeg),
    });
    const [o] = await db.select().from(users).where(eq(users.role, 'owner'));
    owner = await staffToken(app, o);
  });
  afterAll(async () => {
    await app.close();
  });

  const get = (token: string, url: string) =>
    request(app.getHttpServer()).get(url).auth(token, { type: 'bearer' });

  it('has plans in every state, and each plan report answers', async () => {
    const plans = await get(owner, `${A}/day-plans?limit=100`).expect(200);
    expect(plans.body.total).toBe(15);
    const states = plans.body.data.map((p: { status: string }) => p.status);
    for (const s of ['planned', 'in_progress', 'closed', 'reconciled']) {
      expect(states).toContain(s);
    }
    for (const p of plans.body.data as { id: string; status: string }[]) {
      const r = await get(owner, `${A}/day-plans/${p.id}/report`).expect(200);
      if (p.status === 'reconciled') {
        for (const line of r.body.products) {
          expect(line.shortage).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('records exactly one deliberate shortage of one piece', async () => {
    const plans = await get(
      owner,
      `${A}/day-plans?status=reconciled&limit=100`,
    );
    let short = 0;
    for (const p of plans.body.data as { id: string }[]) {
      const r = await get(owner, `${A}/day-plans/${p.id}/report`);
      short += r.body.products.reduce(
        (n: number, l: { shortage: number | null }) => n + (l.shortage ?? 0),
        0,
      );
    }
    expect(short).toBe(1);
  });

  it('has sales, payments in every status, returns, write-offs, expenses and flagged photos', async () => {
    expect((await get(owner, `${A}/sales`)).body.total).toBeGreaterThan(15);
    for (const status of ['pending', 'confirmed', 'bounced']) {
      expect(
        (await get(owner, `${A}/payments?status=${status}`)).body.total,
      ).toBeGreaterThan(0);
    }
    expect((await get(owner, `${A}/returns`)).body.total).toBe(2);
    expect((await get(owner, `${A}/write-offs`)).body.total).toBe(2);
    expect((await get(owner, `${A}/expenses`)).body.total).toBeGreaterThan(20);
    expect(
      (await get(owner, `${A}/visit-photos?flagged=true`)).body.total,
    ).toBe(3);
    expect(files.size).toBeGreaterThan(20);
  });

  it('keeps warehouse stock at zero or more, and every shop balance answers', async () => {
    const rows = await db.select().from(products);
    for (const p of rows) expect(p.stockQuantity).toBeGreaterThanOrEqual(0);
    const shops = await get(owner, `${A}/clients?limit=100`).expect(200);
    expect(shops.body.total).toBe(6);
    for (const s of shops.body.data as { id: string }[]) {
      await get(owner, `${A}/clients/${s.id}/balance`).expect(200);
    }
    const overdue = await get(owner, `${A}/reports/overdue-credit`).expect(200);
    expect(overdue.body.total).toBeGreaterThan(0);
  });

  it('gives a shop its own invoices, payments and returns', async () => {
    const shop = (await get(owner, `${A}/clients?search=Kalimati`)).body
      .data[0] as { id: string };
    const token = await shopToken(app, shop);
    expect(
      (await get(token, `${A}/shop/me/invoices`).expect(200)).body.total,
    ).toBeGreaterThan(0);
    await get(token, `${A}/shop/me/payments`).expect(200);
    expect(
      (await get(token, `${A}/shop/me/returns`).expect(200)).body.total,
    ).toBe(1);
  });
});
