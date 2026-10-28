import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  paymentImages,
  payments,
  products,
  retailClients,
  routeClients,
  saleReturns,
  sales,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { BalanceService } from '../src/ledger/balance.service.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import { StorageService } from '../src/storage/storage.service.js';
import { shopToken, staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Product = typeof products.$inferSelect;
type Client = typeof retailClients.$inferSelect;
type Kind = 'cheque_front' | 'cheque_back' | 'online_screenshot' | 'other';

const PAYMENTS = '/api/v1/payments';
const PLANS = '/api/v1/day-plans';
const SALES = '/api/v1/sales';

function nepalDate(days: number): string {
  const d = new Date(`${nepalToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A distinct small JPEG each call: random pixels, so a different hash. */
const photo = () =>
  sharp(randomBytes(32 * 24 * 3), {
    raw: { width: 32, height: 24, channels: 3 },
  })
    .jpeg()
    .toBuffer();

describe('Payments and balances (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: MemoryStorage;
  let seeded: SeedResult;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let p: Record<string, Product>;
  let shops: Client[];
  let planId: string;
  const tokens = {} as Record<
    | 'owner'
    | 'manager'
    | 'salesman1'
    | 'salesman2'
    | 'shop0'
    | 'shop1'
    | 'bOwner',
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
  /** Multipart payment: text fields plus [kind, image] files. */
  const pay = (
    token: string,
    fields: Record<string, string | number>,
    files: [Kind, Buffer][] = [],
    key = `pay-${randomUUID()}`,
  ) => {
    let req = http()
      .post(PAYMENTS)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v));
    for (const [kind, buf] of files) {
      req = req.attach(kind, buf, {
        filename: `${kind}.jpg`,
        contentType: 'image/jpeg',
      });
    }
    return req;
  };
  const sell = (token: string, body: object) =>
    as(token)
      .post(SALES, body, { 'Idempotency-Key': `sale-${randomUUID()}` })
      .expect(201);
  const line = (sku: string, quantity: number) => ({
    productId: p[sku].id,
    unit: 'base',
    quantity,
  });
  const counts = async () => ({
    payments: (await db.select().from(payments)).length,
    images: (await db.select().from(paymentImages)).length,
    files: storage.files.size,
  });
  const balanceOf = async (shop: Client, token = tokens.manager) =>
    (await as(token).get(`/api/v1/clients/${shop.id}/balance`).expect(200))
      .body;
  const setStatus = (id: string, status: string, token = tokens.manager) =>
    as(token).patch(`${PAYMENTS}/${id}/status`, { status });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    storage = app.get(StorageService);
  });
  beforeEach(async () => {
    await truncateAll(db);
    storage.files.clear();
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
    tokens.shop0 = await shopToken(app, shops[0]);
    tokens.shop1 = await shopToken(app, shops[1]);

    planId = (
      await as(tokens.manager)
        .post(PLANS, {
          salesmanId: staff.salesman1.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock: [line('WTR-1L', 100), line('NDL-70', 100)],
        })
        .expect(201)
    ).body.id;
    await as(tokens.salesman1).post(`${PLANS}/${planId}/start`, {}).expect(200);

    const b = await insertBusiness(db);
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, b.id, { role: 'owner' }),
    );
  });
  afterAll(() => app.close());

  describe('recording payments', () => {
    it('cash is confirmed at once and needs no image (JSON or multipart)', async () => {
      const json = await as(tokens.salesman1)
        .post(
          PAYMENTS,
          { clientId: shops[0].id, method: 'cash', amountPaisa: 5000 },
          { 'Idempotency-Key': `pay-${randomUUID()}` },
        )
        .expect(201);
      expect(json.body).toMatchObject({
        method: 'cash',
        status: 'confirmed',
        amountPaisa: 5000,
        dayPlanId: planId,
        client: { id: shops[0].id },
        collectedBy: { id: staff.salesman1.id },
        images: [],
      });
      const form = await pay(tokens.salesman1, {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 2500,
        note: 'Partial',
        chequeBank: '', // blank optional fields count as missing
      }).expect(201);
      expect(form.body).toMatchObject({ status: 'confirmed', note: 'Partial' });
    });

    it('a cheque with no image is rejected and creates nothing', async () => {
      const res = await pay(tokens.salesman1, {
        clientId: shops[0].id,
        method: 'cheque',
        amountPaisa: 10_000,
        chequeNumber: '000123',
      }).expect(400);
      expect(res.body.error.code).toBe('PROOF_REQUIRED');
      expect(await counts()).toEqual({ payments: 0, images: 0, files: 0 });
    });

    it('a cheque needs its number', async () => {
      const res = await pay(
        tokens.salesman1,
        { clientId: shops[0].id, method: 'cheque', amountPaisa: 10_000 },
        [['cheque_front', await photo()]],
      ).expect(400);
      expect(res.body.error.code).toBe('CHEQUE_NUMBER_REQUIRED');
      expect(await counts()).toEqual({ payments: 0, images: 0, files: 0 });
    });

    it('a cheque with proof is pending, and its images are stamped and stored', async () => {
      const front = await photo();
      const res = await pay(
        tokens.salesman1,
        {
          clientId: shops[0].id,
          method: 'cheque',
          amountPaisa: 10_000,
          chequeNumber: '000123',
          chequeBank: 'Nabil Bank',
          chequeDate: nepalDate(7),
        },
        [
          ['cheque_front', front],
          ['cheque_back', await photo()],
        ],
      ).expect(201);
      expect(res.body).toMatchObject({
        method: 'cheque',
        status: 'pending',
        chequeNumber: '000123',
        chequeBank: 'Nabil Bank',
        chequeDate: nepalDate(7),
      });
      expect(res.body.images.map((i: { kind: string }) => i.kind)).toEqual([
        'cheque_front',
        'cheque_back',
      ]);
      const frontImage = res.body.images[0];
      expect(frontImage.imageKey).toMatch(
        new RegExp(`^${seeded.businessId}/payment-images/[0-9a-f-]{36}$`),
      );
      const stored = storage.files.get(frontImage.imageKey)!;
      expect(stored.buffer.equals(front)).toBe(false); // stamped
      // The image can be fetched through the files route.
      await as(tokens.manager)
        .get(`/api/v1/files/${frontImage.imageKey}`)
        .expect(200);
    });

    it('online needs at least one image and is pending', async () => {
      const none = await pay(tokens.salesman1, {
        clientId: shops[0].id,
        method: 'online',
        amountPaisa: 3000,
      }).expect(400);
      expect(none.body.error.code).toBe('PROOF_REQUIRED');

      const res = await pay(
        tokens.salesman1,
        {
          clientId: shops[0].id,
          method: 'online',
          amountPaisa: 3000,
          referenceNo: 'ESEWA-7781',
        },
        [['online_screenshot', await photo()]],
      ).expect(201);
      expect(res.body).toMatchObject({
        status: 'pending',
        referenceNo: 'ESEWA-7781',
      });
    });

    it('the same screenshot cannot prove two payments', async () => {
      const screenshot = await photo();
      await pay(
        tokens.salesman1,
        { clientId: shops[0].id, method: 'online', amountPaisa: 3000 },
        [['online_screenshot', screenshot]],
      ).expect(201);
      const before = await counts();

      for (const [method, kind, extra] of [
        ['online', 'online_screenshot', {}],
        ['cheque', 'cheque_front', { chequeNumber: '42' }],
      ] as const) {
        const res = await pay(
          tokens.salesman1,
          { clientId: shops[1].id, method, amountPaisa: 3000, ...extra },
          [[kind, Buffer.from(screenshot)]],
        ).expect(409);
        expect(res.body.error.code).toBe('DUPLICATE_IMAGE');
      }
      // Nothing new in the database, and no orphaned file in storage.
      expect(await counts()).toEqual(before);
    });

    it('the same image twice in one request is rejected', async () => {
      const img = await photo();
      const res = await pay(
        tokens.salesman1,
        { clientId: shops[0].id, method: 'online', amountPaisa: 3000 },
        [
          ['online_screenshot', img],
          ['online_screenshot', img],
        ],
      ).expect(409);
      expect(res.body.error.code).toBe('DUPLICATE_IMAGE');
      expect(await counts()).toEqual({ payments: 0, images: 0, files: 0 });
    });

    it('a duplicate that slips past the early check is caught and its uploads removed', async () => {
      // Two requests racing with one screenshot: both pass the early check,
      // the unique index stops the second.
      const img = await photo();
      const results = await Promise.all(
        [0, 1].map((i) =>
          pay(
            tokens.salesman1,
            { clientId: shops[i].id, method: 'online', amountPaisa: 1000 },
            [['online_screenshot', Buffer.from(img)]],
          ),
        ),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await counts()).toEqual({ payments: 1, images: 1, files: 1 });
    });

    it.each([
      ['a cheque image on a cash payment', 'cash', 'cheque_front', {}],
      ['a cheque image on an online payment', 'online', 'cheque_front', {}],
      [
        'a screenshot on a cheque',
        'cheque',
        'online_screenshot',
        { chequeNumber: '1' },
      ],
    ] as const)('rejects %s', async (_label, method, kind, extra) => {
      const res = await pay(
        tokens.salesman1,
        { clientId: shops[0].id, method, amountPaisa: 1000, ...extra },
        [[kind, await photo()]],
      ).expect(400);
      expect(res.body.error.code).toBe('IMAGE_KIND_NOT_ALLOWED');
      expect(await counts()).toEqual({ payments: 0, images: 0, files: 0 });
    });

    it('rejects cheque details on a non-cheque payment', async () => {
      const res = await pay(tokens.salesman1, {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 1000,
        chequeNumber: '9',
      }).expect(400);
      expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('rejects a non-image proof, creating nothing', async () => {
      const res = await pay(
        tokens.salesman1,
        { clientId: shops[0].id, method: 'online', amountPaisa: 1000 },
        [['online_screenshot', Buffer.from('not a picture at all')]],
      ).expect(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      expect(await counts()).toEqual({ payments: 0, images: 0, files: 0 });
    });

    it.each([
      ['a zero amount', { amountPaisa: 0 }],
      ['a fractional amount', { amountPaisa: '10.5' }],
      ['a non-numeric amount', { amountPaisa: 'lots' }],
      ['an unknown method', { method: 'barter' }],
      ['an unknown field', { businessId: randomUUID() }],
    ])('rejects %s', async (_label, overrides) => {
      await pay(tokens.salesman1, {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 1000,
        ...overrides,
      }).expect(400);
    });

    it('checks that saleId is a live sale to the same shop', async () => {
      const sale = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('WTR-1L', 2)],
        })
      ).body;
      const base = { method: 'cash', amountPaisa: 1000, saleId: sale.id };
      const wrongShop = await pay(tokens.salesman1, {
        ...base,
        clientId: shops[1].id,
      }).expect(422);
      expect(wrongShop.body.error.code).toBe('SALE_MISMATCH');
      await pay(tokens.salesman1, {
        ...base,
        clientId: shops[0].id,
        saleId: randomUUID(),
      }).expect(404);

      const ok = await pay(tokens.salesman1, {
        ...base,
        clientId: shops[0].id,
      }).expect(201);
      expect(ok.body.saleId).toBe(sale.id);

      const other = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('WTR-1L', 1)],
        })
      ).body;
      await as(tokens.manager)
        .post(`${SALES}/${other.id}/cancel`, { reason: 'x' })
        .expect(200);
      const cancelled = await pay(tokens.salesman1, {
        ...base,
        clientId: shops[0].id,
        saleId: other.id,
      }).expect(409);
      expect(cancelled.body.error.code).toBe('SALE_CANCELLED');
    });

    it('salesmen collect only on their running day; managers need no plan', async () => {
      const fields = {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 500,
      };
      const notHis = await pay(tokens.salesman2, fields).expect(409);
      expect(notHis.body.error.code).toBe('NO_DAY_IN_PROGRESS');
      await pay(tokens.salesman2, { ...fields, dayPlanId: planId }).expect(404);

      const office = await pay(tokens.manager, fields).expect(201);
      expect(office.body.dayPlanId).toBeNull();
      expect(office.body.collectedBy.id).toBe(staff.manager.id);
    });

    it('a deactivated shop can still pay; another business’s shop cannot be used', async () => {
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.id, shops[2].id));
      await pay(tokens.manager, {
        clientId: shops[2].id,
        method: 'cash',
        amountPaisa: 500,
      }).expect(201);
      const res = await pay(tokens.bOwner, {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 500,
      }).expect(404);
      expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('Idempotency-Key', () => {
    it('a retry returns the first payment and uploads nothing new', async () => {
      const key = `retry-${randomUUID()}`;
      const fields = {
        clientId: shops[0].id,
        method: 'online',
        amountPaisa: 4000,
      };
      const img = await photo();
      const first = await pay(
        tokens.salesman1,
        fields,
        [['online_screenshot', img]],
        key,
      ).expect(201);
      const after = await counts();
      const again = await pay(
        tokens.salesman1,
        fields,
        [['online_screenshot', img]],
        key,
      ).expect(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.body).toEqual(first.body);
      expect(await counts()).toEqual(after);
    });

    it('refuses a key reused for a different payment', async () => {
      const key = `reuse-${randomUUID()}`;
      const fields = {
        clientId: shops[0].id,
        method: 'cash',
        amountPaisa: 1000,
      };
      await pay(tokens.salesman1, fields, [], key).expect(201);
      const res = await pay(
        tokens.salesman1,
        { ...fields, amountPaisa: 2000 },
        [],
        key,
      ).expect(409);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('is required', async () => {
      const res = await as(tokens.salesman1)
        .post(PAYMENTS, {
          clientId: shops[0].id,
          method: 'cash',
          amountPaisa: 1000,
        })
        .expect(400);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });
  });

  describe('clearing cheques and transfers', () => {
    const cheque = async (amountPaisa: number, shop = shops[0]) =>
      (
        await pay(
          tokens.salesman1,
          {
            clientId: shop.id,
            method: 'cheque',
            amountPaisa,
            chequeNumber: `${amountPaisa}`,
          },
          [['cheque_front', await photo()]],
        ).expect(201)
      ).body;

    it('only confirmed payments reduce the balance; pending ones are in clearing', async () => {
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 8)],
      }); // 20000
      const c = await cheque(12_000);

      let bal = await balanceOf(shops[0]);
      expect(bal).toMatchObject({
        balancePaisa: 20_000,
        totalPaymentsPaisa: 0,
        inClearingPaisa: 12_000,
      });

      const confirmed = await setStatus(c.id, 'confirmed').expect(200);
      expect(confirmed.body.status).toBe('confirmed');
      bal = await balanceOf(shops[0]);
      expect(bal).toMatchObject({
        balancePaisa: 8000,
        totalPaymentsPaisa: 12_000,
        inClearingPaisa: 0,
      });
    });

    it('a bounced cheque never reduces the balance', async () => {
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 8)],
      }); // 20000
      const c = await cheque(12_000);
      await setStatus(c.id, 'bounced').expect(200);

      const bal = await balanceOf(shops[0]);
      expect(bal).toMatchObject({
        balancePaisa: 20_000,
        totalPaymentsPaisa: 0,
        inClearingPaisa: 0,
      });
      // And it can never be confirmed afterwards.
      const res = await setStatus(c.id, 'confirmed').expect(409);
      expect(res.body.error.code).toBe('PAYMENT_STATUS_FINAL');
      expect((await balanceOf(shops[0])).balancePaisa).toBe(20_000);
      const statement = await as(tokens.manager).get(
        `/api/v1/clients/${shops[0].id}/statement`,
      );
      expect(
        statement.body.entries.map((e: { type: string }) => e.type),
      ).toEqual(['sale']);
    });

    it('confirmed and bounced are final, and cash cannot be re-statused', async () => {
      const c = await cheque(5000);
      await setStatus(c.id, 'confirmed').expect(200);
      await setStatus(c.id, 'bounced').expect(409);
      const cash = (
        await pay(tokens.salesman1, {
          clientId: shops[0].id,
          method: 'cash',
          amountPaisa: 100,
        })
      ).body;
      await setStatus(cash.id, 'bounced').expect(409);
      await setStatus(c.id, 'pending').expect(400);
    });

    it('only managers and owners change a status, within their business', async () => {
      const c = await cheque(5000);
      await setStatus(c.id, 'confirmed', tokens.salesman1).expect(403);
      await setStatus(c.id, 'confirmed', tokens.bOwner).expect(404);
      await setStatus(c.id, 'confirmed', tokens.owner).expect(200);
    });
  });

  describe('reading payments', () => {
    it('salesmen see only what they collected; managers filter everything', async () => {
      const mine = (
        await pay(tokens.salesman1, {
          clientId: shops[0].id,
          method: 'cash',
          amountPaisa: 100,
        })
      ).body;
      const office = (
        await pay(tokens.manager, {
          clientId: shops[1].id,
          method: 'cash',
          amountPaisa: 200,
        })
      ).body;
      const ids = (res: request.Response) =>
        res.body.data.map((x: { id: string }) => x.id);

      expect(ids(await as(tokens.salesman1).get(PAYMENTS))).toEqual([mine.id]);
      await as(tokens.salesman1).get(`${PAYMENTS}/${office.id}`).expect(404);

      expect(
        ids(
          await as(tokens.manager).get(`${PAYMENTS}?clientId=${shops[1].id}`),
        ),
      ).toEqual([office.id]);
      expect(
        ids(
          await as(tokens.manager).get(
            `${PAYMENTS}?collectedBy=${staff.salesman1.id}&method=cash&status=confirmed`,
          ),
        ),
      ).toEqual([mine.id]);
      expect(
        (
          await as(tokens.manager).get(
            `${PAYMENTS}?from=${nepalToday()}&to=${nepalToday()}`,
          )
        ).body.total,
      ).toBe(2);
      expect(
        (await as(tokens.manager).get(`${PAYMENTS}?to=${nepalDate(-1)}`)).body
          .total,
      ).toBe(0);
      expect((await as(tokens.bOwner).get(PAYMENTS)).body.total).toBe(0);
    });
  });

  describe('balance', () => {
    it('matches a hand-calculated example', async () => {
      // Shop 0: opening 50,000. Sales A 10,000 (due 10 days ago), B 10,000
      // (due 2 days ago), C 5,000 (no due date), D 2,000 (cancelled).
      // Payments: cash 30,000 and cheque 6,000 confirmed; cheque 8,000
      // pending; transfer 4,000 bounced. One return of 1,500.
      //   balance = 50,000 + 25,000 - 36,000 - 1,500 = 37,500
      //   money in = 37,500, all used up by the opening 50,000 (oldest), so
      //   A and B are wholly unpaid and overdue: 20,000. C has no due date.
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: 50_000, creditLimitPaisa: 100_000 })
        .where(eq(retailClients.id, shops[0].id));
      const a = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('WTR-1L', 4)],
        })
      ).body;
      const b = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('NDL-70', 5)],
        })
      ).body;
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 2)],
      });
      const d = (
        await sell(tokens.salesman1, {
          clientId: shops[0].id,
          items: [line('NDL-70', 1)],
        })
      ).body;
      await as(tokens.manager)
        .post(`${SALES}/${d.id}/cancel`, { reason: 'x' })
        .expect(200);
      await db
        .update(sales)
        .set({ dueDate: nepalDate(-10) })
        .where(eq(sales.id, a.id));
      await db
        .update(sales)
        .set({ dueDate: nepalDate(-2) })
        .where(eq(sales.id, b.id));

      const cash = { clientId: shops[0].id, method: 'cash' };
      await pay(tokens.salesman1, { ...cash, amountPaisa: 30_000 }).expect(201);
      const confirmed = (
        await pay(
          tokens.salesman1,
          {
            clientId: shops[0].id,
            method: 'cheque',
            amountPaisa: 6000,
            chequeNumber: '1',
          },
          [['cheque_front', await photo()]],
        )
      ).body;
      await setStatus(confirmed.id, 'confirmed').expect(200);
      await pay(
        tokens.salesman1,
        {
          clientId: shops[0].id,
          method: 'cheque',
          amountPaisa: 8000,
          chequeNumber: '2',
        },
        [['cheque_front', await photo()]],
      ).expect(201);
      const bounced = (
        await pay(
          tokens.salesman1,
          { clientId: shops[0].id, method: 'online', amountPaisa: 4000 },
          [['online_screenshot', await photo()]],
        )
      ).body;
      await setStatus(bounced.id, 'bounced').expect(200);
      await db.insert(saleReturns).values({
        id: randomUUID(),
        businessId: seeded.businessId,
        clientId: shops[0].id,
        receivedBy: staff.manager.id,
        returnDate: nepalToday(),
        totalPaisa: 1500,
        createdAt: new Date(),
      });

      const bal = await balanceOf(shops[0]);
      expect(bal).toEqual({
        clientId: shops[0].id,
        asOf: nepalToday(),
        openingBalancePaisa: 50_000,
        totalSalesPaisa: 25_000,
        totalPaymentsPaisa: 36_000,
        totalReturnsPaisa: 1500,
        balancePaisa: 37_500,
        owedPaisa: 37_500,
        creditPaisa: 0,
        creditLimitPaisa: 100_000,
        inClearingPaisa: 8000,
        overduePaisa: 20_000,
        overdueSales: [
          expect.objectContaining({
            saleId: a.id,
            dueDate: nepalDate(-10),
            unpaidPaisa: 10_000,
          }),
          expect.objectContaining({
            saleId: b.id,
            dueDate: nepalDate(-2),
            unpaidPaisa: 10_000,
          }),
        ],
      });
      // The one balance definition agrees.
      const fromService = await app
        .get(BalanceService)
        .balanceOf(seeded.businessId, shops[0].id);
      expect(fromService).toBe(37_500);
    });

    it('settles the oldest sale first when working out what is overdue', async () => {
      // Shop 1: A 10,000 then B 10,000, both past due; 15,000 paid. A is
      // settled in full, B has 5,000 left, so only 5,000 is overdue.
      const a = (
        await sell(tokens.salesman1, {
          clientId: shops[1].id,
          items: [line('WTR-1L', 4)],
        })
      ).body;
      const b = (
        await sell(tokens.salesman1, {
          clientId: shops[1].id,
          items: [line('WTR-1L', 4)],
        })
      ).body;
      await db
        .update(sales)
        .set({ dueDate: nepalDate(-5) })
        .where(eq(sales.id, a.id));
      await db
        .update(sales)
        .set({ dueDate: nepalDate(-1) })
        .where(eq(sales.id, b.id));
      await pay(tokens.salesman1, {
        clientId: shops[1].id,
        method: 'cash',
        amountPaisa: 15_000,
      }).expect(201);

      const bal = await balanceOf(shops[1]);
      expect(bal).toMatchObject({ balancePaisa: 5000, overduePaisa: 5000 });
      expect(bal.overdueSales).toEqual([
        expect.objectContaining({ saleId: b.id, unpaidPaisa: 5000 }),
      ]);
    });

    it('reports a negative balance as credit', async () => {
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: -3000 })
        .where(eq(retailClients.id, shops[2].id));
      const a = (
        await sell(tokens.salesman1, {
          clientId: shops[2].id,
          items: [line('NDL-70', 1)],
        })
      ).body;
      await db
        .update(sales)
        .set({ dueDate: nepalDate(-1) })
        .where(eq(sales.id, a.id));
      expect(await balanceOf(shops[2])).toMatchObject({
        balancePaisa: -1000,
        owedPaisa: 0,
        creditPaisa: 1000,
        overduePaisa: 0,
        overdueSales: [],
      });
    });

    it('is visible to any staff of the business, and nobody else', async () => {
      await balanceOf(shops[0], tokens.salesman2);
      await as(tokens.bOwner)
        .get(`/api/v1/clients/${shops[0].id}/balance`)
        .expect(404);
    });
  });

  describe('statement', () => {
    it('merges sales, payments and returns by date with a running balance', async () => {
      await db
        .update(retailClients)
        .set({ openingBalancePaisa: 1000 })
        .where(eq(retailClients.id, shops[1].id));
      const a = (
        await sell(tokens.salesman1, {
          clientId: shops[1].id,
          items: [line('WTR-1L', 4)],
        })
      ).body; // 10,000
      const b = (
        await sell(tokens.salesman1, {
          clientId: shops[1].id,
          items: [line('NDL-70', 3)],
        })
      ).body; // 6,000
      const cash = (
        await pay(tokens.salesman1, {
          clientId: shops[1].id,
          method: 'cash',
          amountPaisa: 7000,
        })
      ).body;
      const ret = randomUUID();
      await db.insert(saleReturns).values({
        id: ret,
        businessId: seeded.businessId,
        clientId: shops[1].id,
        receivedBy: staff.manager.id,
        returnDate: nepalDate(-1),
        totalPaisa: 500,
        createdAt: new Date(),
      });
      // Spread them over the past week.
      await db
        .update(sales)
        .set({ saleDate: nepalDate(-6) })
        .where(eq(sales.id, a.id));
      await db
        .update(sales)
        .set({ saleDate: nepalDate(-4) })
        .where(eq(sales.id, b.id));
      await db
        .update(payments)
        .set({ receivedAt: new Date(`${nepalDate(-3)}T06:00:00Z`) })
        .where(eq(payments.id, cash.id));

      const full = await as(tokens.manager)
        .get(`/api/v1/clients/${shops[1].id}/statement`)
        .expect(200);
      expect(full.body).toMatchObject({
        openingBalancePaisa: 1000,
        closingBalancePaisa: 1000 + 10_000 + 6000 - 7000 - 500,
      });
      expect(
        full.body.entries.map(
          (e: {
            date: string;
            type: string;
            debitPaisa: number;
            creditPaisa: number;
            balancePaisa: number;
          }) => [e.date, e.type, e.debitPaisa, e.creditPaisa, e.balancePaisa],
        ),
      ).toEqual([
        [nepalDate(-6), 'sale', 10_000, 0, 11_000],
        [nepalDate(-4), 'sale', 6000, 0, 17_000],
        [nepalDate(-3), 'payment', 0, 7000, 10_000],
        [nepalDate(-1), 'return', 0, 500, 9500],
      ]);
      expect(full.body.entries[0].reference).toBe(
        `Invoice #${a.invoiceNumber}`,
      );

      const ranged = await as(tokens.manager)
        .get(
          `/api/v1/clients/${shops[1].id}/statement?from=${nepalDate(-4)}&to=${nepalDate(-2)}`,
        )
        .expect(200);
      expect(ranged.body).toMatchObject({
        openingBalancePaisa: 11_000,
        closingBalancePaisa: 10_000,
      });
      expect(ranged.body.entries.map((e: { type: string }) => e.type)).toEqual([
        'sale',
        'payment',
      ]);

      await as(tokens.manager)
        .get(
          `/api/v1/clients/${shops[1].id}/statement?from=${nepalDate(0)}&to=${nepalDate(-1)}`,
        )
        .expect(400);
    });
  });

  describe('a shop’s own view', () => {
    beforeEach(async () => {
      await sell(tokens.salesman1, {
        clientId: shops[0].id,
        items: [line('WTR-1L', 2)],
      });
      await sell(tokens.salesman1, {
        clientId: shops[1].id,
        items: [line('NDL-70', 7)],
      });
    });

    it('GET /shop/me/balance and /statement show the shop’s own account', async () => {
      const mine = await as(tokens.shop0)
        .get('/api/v1/shop/me/balance')
        .expect(200);
      expect(mine.body).toEqual(await balanceOf(shops[0]));
      expect(mine.body.balancePaisa).toBe(5000);

      const statement = await as(tokens.shop0)
        .get('/api/v1/shop/me/statement')
        .expect(200);
      expect(statement.body.clientId).toBe(shops[0].id);
      expect(statement.body.closingBalancePaisa).toBe(5000);
    });

    it('a shop cannot read another shop’s balance', async () => {
      for (const url of [
        `/api/v1/clients/${shops[1].id}/balance`,
        `/api/v1/clients/${shops[1].id}/statement`,
        `/api/v1/clients/${shops[0].id}/balance`, // even its own, via staff routes
        `${PAYMENTS}`,
      ]) {
        const res = await as(tokens.shop0).get(url).expect(403);
        expect(res.text).not.toContain('14000');
      }
      const own = await as(tokens.shop1).get('/api/v1/shop/me/balance');
      expect(own.body).toMatchObject({
        clientId: shops[1].id,
        balancePaisa: 14_000,
      });
    });

    it('staff tokens cannot use the shop routes', async () => {
      await as(tokens.manager).get('/api/v1/shop/me/balance').expect(403);
    });
  });
});
