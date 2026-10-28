import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import { expenses, users } from '../src/database/schema/index.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import { StorageService } from '../src/storage/storage.service.js';
import { expectNoSecrets, shopToken, staffToken } from './utils/auth.js';
import { insertSalesContext, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;

const EXPENSES = '/api/v1/expenses';

/** 'YYYY-MM' of the month `back` months before this one (Nepal date). */
function monthBack(back: number): string {
  const [y, m] = nepalToday().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 7);
}

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

describe('Expenses (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: MemoryStorage;
  let ctx: Awaited<ReturnType<typeof insertSalesContext>>;
  let staff: Record<'owner' | 'manager' | 'salesman1' | 'salesman2', User>;
  let otherBiz: { manager: User; salesman: User };
  const tokens = {} as Record<
    'owner' | 'manager' | 'salesman1' | 'salesman2' | 'bManager',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  /** Multipart expense: text fields plus an optional receipt. */
  const multipart = (
    token: string,
    fields: Record<string, string | number>,
    receipt?: Buffer,
  ) => {
    let req = http().post(EXPENSES).auth(token, { type: 'bearer' });
    for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v));
    if (receipt) {
      req = req.attach('receipt', receipt, {
        filename: 'receipt.jpg',
        contentType: 'image/jpeg',
      });
    }
    return req;
  };
  const create = (token: string, body: object) =>
    as(token).post(EXPENSES, body).expect(201);
  const rowCount = async () => (await db.select().from(expenses)).length;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    storage = app.get(StorageService);
  });
  beforeEach(async () => {
    await truncateAll(db);
    storage.files.clear();
    ctx = await insertSalesContext(db);
    staff = {
      owner: await insertUser(db, ctx.business.id, { role: 'owner' }),
      manager: ctx.manager,
      salesman1: ctx.salesman,
      salesman2: await insertUser(db, ctx.business.id, { role: 'salesman' }),
    };
    for (const k of Object.keys(staff) as (keyof typeof staff)[]) {
      tokens[k] = await staffToken(app, staff[k]);
    }
    const other = await insertSalesContext(db);
    otherBiz = { manager: other.manager, salesman: other.salesman };
    tokens.bManager = await staffToken(app, other.manager);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /expenses', () => {
    it('rejects a salary without a user, and stores nothing', async () => {
      for (const token of [tokens.manager, tokens.owner]) {
        const res = await as(token)
          .post(EXPENSES, { type: 'salary', amountPaisa: 2_500_000 })
          .expect(400);
        expect(res.body.error.code).toBe('USER_REQUIRED');
      }
      expect(await rowCount()).toBe(0);
    });

    it('lets a manager record a salary for any staff member', async () => {
      const res = await create(tokens.manager, {
        type: 'salary',
        amountPaisa: 2_500_000,
        userId: staff.salesman2.id,
        forMonth: monthBack(1),
        description: 'Ashwin salary',
      });
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        type: 'salary',
        amountPaisa: 2_500_000,
        expenseDate: nepalToday(),
        forMonth: `${monthBack(1)}-01`,
        userId: staff.salesman2.id,
        user: { id: staff.salesman2.id },
        recordedBy: { id: staff.manager.id },
        receiptKey: null,
      });
    });

    it('defaults a salary’s month to the expense date’s month', async () => {
      const date = `${monthBack(2)}-20`;
      const res = await create(tokens.owner, {
        type: 'salary',
        amountPaisa: 100,
        userId: staff.manager.id,
        expenseDate: date,
      });
      expect(res.body.forMonth).toBe(`${monthBack(2)}-01`);
    });

    it('lets a manager record a business expense with no user', async () => {
      const res = await create(tokens.manager, {
        type: 'miscellaneous',
        amountPaisa: 50_000,
      });
      expect(res.body).toMatchObject({ userId: null, user: null });
    });

    it('never lets a salesman record a salary, not even his own', async () => {
      for (const userId of [undefined, staff.salesman1.id]) {
        const res = await as(tokens.salesman1)
          .post(EXPENSES, { type: 'salary', amountPaisa: 100, userId })
          .expect(403);
        expect(res.body.error.code).toBe('EXPENSE_TYPE_NOT_ALLOWED');
      }
      expect(await rowCount()).toBe(0);
    });

    it.each(['fuel', 'khaja', 'miscellaneous'])(
      'lets a salesman record %s for himself (the default user)',
      async (type) => {
        const res = await create(tokens.salesman1, { type, amountPaisa: 300 });
        expect(res.body).toMatchObject({
          type,
          userId: staff.salesman1.id,
          recordedBy: { id: staff.salesman1.id },
        });
      },
    );

    it('refuses a salesman recording for anyone else', async () => {
      const res = await as(tokens.salesman1)
        .post(EXPENSES, {
          type: 'fuel',
          amountPaisa: 300,
          userId: staff.salesman2.id,
        })
        .expect(403);
      expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
      expect(await rowCount()).toBe(0);
    });

    it.each([0, -5, 1.5, 'abc'])(
      'rejects amountPaisa %p',
      async (amountPaisa) => {
        await as(tokens.manager)
          .post(EXPENSES, { type: 'fuel', amountPaisa })
          .expect(400);
      },
    );

    it('rejects an unknown type, a future date and forMonth on non-salary', async () => {
      await as(tokens.manager)
        .post(EXPENSES, { type: 'rent', amountPaisa: 100 })
        .expect(400);
      const future = await as(tokens.manager)
        .post(EXPENSES, {
          type: 'fuel',
          amountPaisa: 100,
          expenseDate: nepalDate(1),
        })
        .expect(400);
      expect(future.body.error.code).toBe('DATE_IN_FUTURE');
      const month = await as(tokens.manager)
        .post(EXPENSES, { type: 'fuel', amountPaisa: 100, forMonth: '2026-01' })
        .expect(400);
      expect(month.body.error.code).toBe('FIELD_NOT_ALLOWED');
      await as(tokens.manager)
        .post(EXPENSES, {
          type: 'salary',
          amountPaisa: 100,
          userId: staff.manager.id,
          forMonth: '2026-13',
        })
        .expect(400);
      expect(await rowCount()).toBe(0);
    });

    it('treats a user of another business as missing', async () => {
      const res = await as(tokens.manager)
        .post(EXPENSES, {
          type: 'salary',
          amountPaisa: 100,
          userId: otherBiz.salesman.id,
        })
        .expect(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('links a day plan only of the same staff member', async () => {
      const ok = await create(tokens.salesman1, {
        type: 'fuel',
        amountPaisa: 100,
        dayPlanId: ctx.dayPlan.id,
      });
      expect(ok.body.dayPlanId).toBe(ctx.dayPlan.id);
      const res = await as(tokens.salesman2)
        .post(EXPENSES, {
          type: 'fuel',
          amountPaisa: 100,
          dayPlanId: ctx.dayPlan.id,
        })
        .expect(400);
      expect(res.body.error.code).toBe('DAY_PLAN_USER_MISMATCH');
    });

    it('accepts multipart with a receipt, stored under a key and served back', async () => {
      const res = await multipart(
        tokens.salesman1,
        { type: 'fuel', amountPaisa: '45000', description: 'Petrol' },
        await photo(),
      ).expect(201);
      expect(res.body.amountPaisa).toBe(45_000);
      const key: string = res.body.receiptKey;
      expect(key).toMatch(
        new RegExp(`^${ctx.business.id}/expense-receipts/[0-9a-f-]{36}$`),
      );
      expect(storage.files.has(key)).toBe(true);
      const [row] = await db
        .select({ receiptKey: expenses.receiptKey })
        .from(expenses);
      expect(row.receiptKey).toBe(key); // a key, never a URL

      const file = await as(tokens.manager)
        .get(`/api/v1/files/${key}`)
        .expect(200);
      expect(file.headers['content-type']).toBe('image/jpeg');
    });

    it('accepts multipart without a receipt, blank fields counting as missing', async () => {
      const res = await multipart(tokens.salesman1, {
        type: 'khaja',
        amountPaisa: '150',
        expenseDate: '',
        userId: '',
      }).expect(201);
      expect(res.body).toMatchObject({
        receiptKey: null,
        expenseDate: nepalToday(),
        userId: staff.salesman1.id,
      });
    });

    it('rejects a receipt that is not an image, storing nothing', async () => {
      const res = await http()
        .post(EXPENSES)
        .auth(tokens.salesman1, { type: 'bearer' })
        .field('type', 'fuel')
        .field('amountPaisa', '100')
        .attach('receipt', Buffer.from('%PDF-1.4 not an image'), {
          filename: 'receipt.jpg',
          contentType: 'image/jpeg',
        })
        .expect(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      expect(await rowCount()).toBe(0);
      expect(storage.files.size).toBe(0);
    });

    it('does not upload a receipt when the expense is refused', async () => {
      await multipart(
        tokens.salesman1,
        { type: 'salary', amountPaisa: '100' },
        await photo(),
      ).expect(403);
      expect(storage.files.size).toBe(0);
    });
  });

  describe('GET /expenses', () => {
    beforeEach(async () => {
      await create(tokens.salesman1, {
        type: 'fuel',
        amountPaisa: 100,
        expenseDate: `${monthBack(1)}-10`,
      });
      await create(tokens.salesman1, { type: 'khaja', amountPaisa: 200 });
      await create(tokens.salesman2, { type: 'fuel', amountPaisa: 400 });
      await create(tokens.manager, {
        type: 'salary',
        amountPaisa: 800,
        userId: staff.salesman2.id,
      });
      await create(tokens.manager, {
        type: 'miscellaneous',
        amountPaisa: 1600,
      });
      await create(tokens.bManager, { type: 'fuel', amountPaisa: 3200 });
    });
    const amounts = (res: request.Response) =>
      (res.body.data as { amountPaisa: number }[])
        .map((e) => e.amountPaisa)
        .sort((a, b) => a - b);

    it('shows a salesman only his own, whatever filter he sends', async () => {
      const own = await as(tokens.salesman1).get(EXPENSES).expect(200);
      expect(amounts(own)).toEqual([100, 200]);
      expect(own.body.total).toBe(2);

      const sneaky = await as(tokens.salesman1)
        .get(`${EXPENSES}?userId=${staff.salesman2.id}`)
        .expect(200);
      expect(amounts(sneaky)).toEqual([100, 200]);

      const two = await as(tokens.salesman2).get(EXPENSES).expect(200);
      expect(amounts(two)).toEqual([400, 800]); // his salary is his to see
    });

    it('shows managers the whole business, never another', async () => {
      const res = await as(tokens.manager).get(EXPENSES).expect(200);
      expect(amounts(res)).toEqual([100, 200, 400, 800, 1600]);
      expectNoSecrets(res);
    });

    it('filters by type, user and date range', async () => {
      const fuel = await as(tokens.owner).get(`${EXPENSES}?type=fuel`);
      expect(amounts(fuel)).toEqual([100, 400]);
      const user = await as(tokens.owner).get(
        `${EXPENSES}?userId=${staff.salesman2.id}`,
      );
      expect(amounts(user)).toEqual([400, 800]);
      const today = await as(tokens.owner).get(
        `${EXPENSES}?from=${nepalToday()}&to=${nepalToday()}`,
      );
      expect(amounts(today)).toEqual([200, 400, 800, 1600]);
      const last = await as(tokens.owner).get(
        `${EXPENSES}?to=${monthBack(1)}-28&type=fuel`,
      );
      expect(amounts(last)).toEqual([100]);
      await as(tokens.owner)
        .get(`${EXPENSES}?from=${nepalToday()}&to=${monthBack(1)}-01`)
        .expect(400);
      await as(tokens.owner).get(`${EXPENSES}?type=rent`).expect(400);
    });
  });

  describe('PATCH /expenses/:id', () => {
    let fuelId: string;
    let salaryId: string;
    beforeEach(async () => {
      fuelId = (
        await create(tokens.salesman1, { type: 'fuel', amountPaisa: 100 })
      ).body.id;
      salaryId = (
        await create(tokens.manager, {
          type: 'salary',
          amountPaisa: 900,
          userId: staff.salesman2.id,
          forMonth: monthBack(1),
        })
      ).body.id;
    });

    it('is for managers and owners only', async () => {
      for (const token of [tokens.salesman1, tokens.salesman2]) {
        await as(token)
          .patch(`${EXPENSES}/${fuelId}`, { amountPaisa: 1 })
          .expect(403);
      }
      const res = await as(tokens.owner)
        .patch(`${EXPENSES}/${fuelId}`, {
          amountPaisa: 150,
          description: 'Corrected',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        amountPaisa: 150,
        description: 'Corrected',
        type: 'fuel',
        userId: staff.salesman1.id,
      });
    });

    it('keeps a salary tied to a user', async () => {
      const cleared = await as(tokens.manager)
        .patch(`${EXPENSES}/${salaryId}`, { userId: null })
        .expect(400);
      expect(cleared.body.error.code).toBe('USER_REQUIRED');

      const misc = (
        await create(tokens.manager, { type: 'miscellaneous', amountPaisa: 5 })
      ).body.id;
      const retyped = await as(tokens.manager)
        .patch(`${EXPENSES}/${misc}`, { type: 'salary' })
        .expect(400);
      expect(retyped.body.error.code).toBe('USER_REQUIRED');
    });

    it('moves forMonth with the type', async () => {
      const toFuel = await as(tokens.manager)
        .patch(`${EXPENSES}/${salaryId}`, { type: 'fuel' })
        .expect(200);
      expect(toFuel.body.forMonth).toBeNull();
      const back = await as(tokens.manager)
        .patch(`${EXPENSES}/${salaryId}`, { type: 'salary' })
        .expect(200);
      expect(back.body.forMonth).toBe(`${nepalToday().slice(0, 7)}-01`);
      const bad = await as(tokens.manager)
        .patch(`${EXPENSES}/${fuelId}`, { forMonth: '2026-01' })
        .expect(400);
      expect(bad.body.error.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('rejects clearing required fields and unknown ones', async () => {
      await as(tokens.manager)
        .patch(`${EXPENSES}/${fuelId}`, { amountPaisa: null })
        .expect(400);
      await as(tokens.manager)
        .patch(`${EXPENSES}/${fuelId}`, { amountPaisa: 0 })
        .expect(400);
      await as(tokens.manager)
        .patch(`${EXPENSES}/${fuelId}`, { receiptKey: 'x' })
        .expect(400);
      await as(tokens.manager)
        .patch(`${EXPENSES}/${fuelId}`, { expenseDate: nepalDate(1) })
        .expect(400);
    });

    it('treats another business’s expense as missing', async () => {
      const res = await as(tokens.bManager)
        .patch(`${EXPENSES}/${fuelId}`, { amountPaisa: 1 })
        .expect(404);
      expect(res.body.error.code).toBe('EXPENSE_NOT_FOUND');
      await as(tokens.manager)
        .patch(`${EXPENSES}/${salaryId}`, { userId: otherBiz.salesman.id })
        .expect(404);
    });
  });

  describe('GET /expenses/summary', () => {
    const m2 = monthBack(2);
    const m1 = monthBack(1);

    beforeEach(async () => {
      const add = (token: string, body: object) => create(token, body);
      // In range (m2-05 .. m1-28):
      await add(tokens.manager, {
        type: 'salary',
        amountPaisa: 2_000_000,
        userId: staff.salesman1.id,
        expenseDate: `${m2}-05`,
      });
      await add(tokens.salesman1, {
        type: 'fuel',
        amountPaisa: 30_000,
        expenseDate: `${m2}-05`,
      });
      await add(tokens.salesman2, {
        type: 'fuel',
        amountPaisa: 12_550,
        expenseDate: `${m2}-28`,
      });
      await add(tokens.salesman1, {
        type: 'khaja',
        amountPaisa: 1_500,
        expenseDate: `${m1}-01`,
      });
      await add(tokens.manager, {
        type: 'salary',
        amountPaisa: 1_800_000,
        userId: staff.salesman2.id,
        expenseDate: `${m1}-28`,
      });
      await add(tokens.salesman2, {
        type: 'khaja',
        amountPaisa: 2_250,
        expenseDate: `${m1}-15`,
      });
      // Outside the range, either side:
      await add(tokens.salesman1, {
        type: 'fuel',
        amountPaisa: 99_999,
        expenseDate: `${m2}-04`,
      });
      await add(tokens.manager, { type: 'miscellaneous', amountPaisa: 77_777 });
      // Another business, same dates:
      await add(tokens.bManager, {
        type: 'fuel',
        amountPaisa: 55_555,
        expenseDate: `${m2}-10`,
      });
    });
    const range = `from=${m2}-05&to=${m1}-28`;

    it('matches a hand calculation', async () => {
      const res = await as(tokens.manager)
        .get(`${EXPENSES}/summary?${range}`)
        .expect(200);
      // fuel 30,000 + 12,550; khaja 1,500 + 2,250; salary 2,000,000 + 1,800,000
      expect(res.body).toEqual({
        from: `${m2}-05`,
        to: `${m1}-28`,
        totalPaisa: 3_846_300,
        byType: [
          { type: 'salary', totalPaisa: 3_800_000, count: 2 },
          { type: 'fuel', totalPaisa: 42_550, count: 2 },
          { type: 'khaja', totalPaisa: 3_750, count: 2 },
          { type: 'miscellaneous', totalPaisa: 0, count: 0 },
        ],
        byMonth: [
          {
            month: m2,
            totalPaisa: 2_042_550,
            byType: {
              salary: 2_000_000,
              fuel: 42_550,
              khaja: 0,
              miscellaneous: 0,
            },
          },
          {
            month: m1,
            totalPaisa: 1_803_750,
            byType: {
              salary: 1_800_000,
              fuel: 0,
              khaja: 3_750,
              miscellaneous: 0,
            },
          },
        ],
      });
    });

    it('covers only a salesman’s own expenses', async () => {
      const res = await as(tokens.salesman1)
        .get(`${EXPENSES}/summary?${range}`)
        .expect(200);
      // salary 2,000,000 (his) + fuel 30,000 + khaja 1,500
      expect(res.body.totalPaisa).toBe(2_031_500);
      expect(res.body.byMonth).toEqual([
        {
          month: m2,
          totalPaisa: 2_030_000,
          byType: {
            salary: 2_000_000,
            fuel: 30_000,
            khaja: 0,
            miscellaneous: 0,
          },
        },
        {
          month: m1,
          totalPaisa: 1_500,
          byType: { salary: 0, fuel: 0, khaja: 1_500, miscellaneous: 0 },
        },
      ]);
    });

    it('is empty, with every type at zero, for a quiet range', async () => {
      const res = await as(tokens.bManager)
        .get(`${EXPENSES}/summary?${range}`)
        .expect(200);
      expect(res.body.totalPaisa).toBe(55_555);
      const none = await as(tokens.manager)
        .get(`${EXPENSES}/summary?from=2020-01-01&to=2020-12-31`)
        .expect(200);
      expect(none.body.totalPaisa).toBe(0);
      expect(none.body.byMonth).toEqual([]);
      expect(none.body.byType).toHaveLength(4);
    });

    it('requires a valid range', async () => {
      await as(tokens.manager).get(`${EXPENSES}/summary`).expect(400);
      await as(tokens.manager)
        .get(`${EXPENSES}/summary?from=${m2}-01`)
        .expect(400);
      const res = await as(tokens.manager)
        .get(`${EXPENSES}/summary?from=${m1}-01&to=${m2}-01`)
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  it('is staff only', async () => {
    const shop = await shopToken(app, ctx.client);
    await as(shop).get(EXPENSES).expect(403);
    await as(shop)
      .get(`${EXPENSES}/summary?from=2026-01-01&to=2026-01-31`)
      .expect(403);
    await as(shop).post(EXPENSES, { type: 'fuel', amountPaisa: 1 }).expect(403);
    await http().get(EXPENSES).expect(401);
  });
});
