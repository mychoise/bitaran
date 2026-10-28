import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  products,
  retailClients,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type Who = 'owner' | 'manager' | 'salesman' | 'shop' | 'anonymous';
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Staff-only fields that must never reach a salesman or a shop. */
const COST_FIELDS = /cost(Price|Value)Paisa/;

const photo = () =>
  sharp(randomBytes(32 * 24 * 3), {
    raw: { width: 32, height: 24, channels: 3 },
  })
    .jpeg()
    .toBuffer();

/**
 * Calls every registered route (taken from the OpenAPI document, so a new
 * route is covered automatically) with real seeded data, as every kind of
 * caller, and checks each response:
 *   - no response ever carries a password hash;
 *   - no salesman or shop response carries a cost price.
 * Fails too if any route was never answered with a 2xx, so a route cannot
 * pass by only ever returning errors.
 */
describe('Every route, every caller (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  const tokens = {} as Record<Exclude<Who, 'anonymous'>, string>;
  const violations: string[] = [];
  const answered = new Set<string>(); // "GET /api/v1/sales/{id}" with a 2xx
  let routes: string[];

  /** Calls `template` (OpenAPI form, e.g. /api/v1/sales/{id}) as `who`. */
  async function call(
    who: Who,
    method: Method,
    template: string,
    opts: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: object;
      headers?: Record<string, string>;
      fields?: Record<string, string | number>;
      files?: [string, Buffer][];
    } = {},
  ) {
    const url = template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = opts.params?.[name];
      if (!value) throw new Error(`No value for {${name}} in ${template}`);
      return value;
    });
    let req = request(app.getHttpServer())
      [method.toLowerCase() as 'get'](url)
      .query(opts.query ?? {})
      .set(opts.headers ?? {});
    if (who !== 'anonymous') req = req.auth(tokens[who], { type: 'bearer' });
    if (opts.fields || opts.files) {
      for (const [k, v] of Object.entries(opts.fields ?? {})) {
        req = req.field(k, String(v));
      }
      for (const [field, buf] of opts.files ?? []) {
        req = req.attach(field, buf, {
          filename: `${field}.jpg`,
          contentType: 'image/jpeg',
        });
      }
    } else if (opts.body) {
      req = req.send(opts.body);
    }
    const res = await req;

    const label = `${who} ${method} ${template} -> ${res.status}`;
    const text = res.text ?? '';
    if (/password_?hash/i.test(text) || text.includes('$argon2')) {
      violations.push(`${label}: password hash in response`);
    }
    if ((who === 'salesman' || who === 'shop') && COST_FIELDS.test(text)) {
      violations.push(`${label}: cost price in response`);
    }
    if (res.status >= 500) violations.push(`${label}: server error ${text}`);
    if (res.status >= 200 && res.status < 300) {
      answered.add(`${method} ${template}`);
    }
    return res;
  }
  /** As `call`, but this caller must succeed. */
  async function ok(...args: Parameters<typeof call>) {
    const res = await call(...args);
    if (res.status >= 300) {
      throw new Error(
        `${args[0]} ${args[1]} ${args[2]} failed: ${res.status} ${res.text}`,
      );
    }
    return res;
  }

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await truncateAll(db);
    seeded = await seed(db);
    const docs = await request(app.getHttpServer()).get('/docs-json');
    routes = Object.entries(
      docs.body.paths as Record<string, Record<string, unknown>>,
    ).flatMap(([path, ops]) =>
      Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`),
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it('never leaks a password hash, nor cost prices to salesmen and shops', async () => {
    const A = '/api/v1';
    const today = nepalToday();
    const login = (type: 'staff' | 'shop', role: string) =>
      seeded.logins.find((l) => l.type === type && l.role === role)!;

    // ---------- logging in, as each caller ----------
    for (const [who, type, role] of [
      ['owner', 'staff', 'owner'],
      ['manager', 'staff', 'manager'],
      ['salesman', 'staff', 'salesman'],
      ['shop', 'shop', 'shop'],
    ] as const) {
      const { email, password } = login(type, role);
      const res = await ok('anonymous', 'POST', `${A}/auth/${type}/login`, {
        body: { email, password },
      });
      tokens[who] = res.body.accessToken;
    }
    expect(Object.values(tokens).every(Boolean)).toBe(true);

    const [salesman] = await db
      .select()
      .from(users)
      .where(eq(users.email, login('staff', 'salesman').email));
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.businessId, seeded.businessId))
      .limit(1);
    const [shop] = await db
      .select()
      .from(retailClients)
      .where(eq(retailClients.email, login('shop', 'shop').email));

    // ---------- the business and its people ----------
    await ok('owner', 'PATCH', `${A}/business`, {
      body: { phone: '9801999999' },
    });
    const staff = await ok('owner', 'POST', `${A}/staff`, {
      body: {
        fullName: 'Walk Salesman',
        email: 'walk.salesman@asva.test',
        role: 'salesman',
        password: 'Walk@12345',
      },
    });
    const staffId: string = staff.body.id;
    await ok('owner', 'PATCH', `${A}/staff/{id}`, {
      params: { id: staffId },
      body: { fullName: 'Walk Salesman II' },
    });
    await ok('owner', 'POST', `${A}/staff/{id}/reset-password`, {
      params: { id: staffId },
      body: { temporaryPassword: 'Temp@12345' },
    });

    // ---------- catalog ----------
    const category = await ok('manager', 'POST', `${A}/product-categories`, {
      body: { name: 'Walk category' },
    });
    const categoryId: string = category.body.id;
    await ok('manager', 'PATCH', `${A}/product-categories/{id}`, {
      params: { id: categoryId },
      body: { name: 'Walk category II' },
    });
    const created = await ok('manager', 'POST', `${A}/products`, {
      body: {
        name: 'Walk Noodles',
        pricePaisa: 2500,
        costPricePaisa: 1800,
        unitsPerCarton: 30,
        stockQuantity: 100,
        lowStockAlert: 200,
      },
    });
    expect(created.body.costPricePaisa).toBe(1800); // managers see it
    await ok('manager', 'PATCH', `${A}/products/{id}`, {
      params: { id: created.body.id },
      body: { mrpPaisa: 3000 },
    });
    await ok('manager', 'POST', `${A}/products/{id}/stock-adjust`, {
      params: { id: product.id },
      body: { delta: 50 },
    });

    // ---------- routes and shops ----------
    const newShop = await ok('manager', 'POST', `${A}/clients`, {
      body: {
        name: 'Walk Pasal',
        email: 'walk.pasal@asva.test',
        password: 'Shop@12345',
        creditLimitPaisa: 1_000_000,
      },
    });
    const newShopId: string = newShop.body.id;
    await ok('manager', 'PATCH', `${A}/clients/{id}`, {
      params: { id: newShopId },
      body: { phone: '9800011111' },
    });
    await ok('manager', 'POST', `${A}/clients/{id}/reset-password`, {
      params: { id: newShopId },
      body: { temporaryPassword: 'Temp@12345' },
    });
    const route = await ok('manager', 'POST', `${A}/routes`, {
      body: { name: 'Walk route' },
    });
    const routeId: string = route.body.id;
    await ok('manager', 'PATCH', `${A}/routes/{id}`, {
      params: { id: routeId },
      body: { description: 'For the walk' },
    });
    await ok('manager', 'PUT', `${A}/routes/{id}/clients`, {
      params: { id: routeId },
      body: { clientIds: [newShopId] },
    });

    // ---------- a day on the road ----------
    const plan = await ok('manager', 'POST', `${A}/day-plans`, {
      body: {
        salesmanId: salesman.id,
        routeId: seeded.routeId,
        planDate: today,
        stock: [{ productId: product.id, unit: 'base', quantity: 20 }],
      },
    });
    const planId: string = plan.body.id;
    // A second plan, only to be deleted at the end.
    const spare = await ok('manager', 'POST', `${A}/day-plans`, {
      body: {
        salesmanId: salesman.id,
        routeId,
        planDate: today,
        stock: [],
      },
    });
    await ok('salesman', 'POST', `${A}/day-plans/{id}/start`, {
      params: { id: planId },
    });
    const added = await ok('salesman', 'POST', `${A}/day-plans/{id}/visits`, {
      params: { id: planId },
      body: { clientId: newShopId },
    });
    const visitId: string = added.body.id;
    await ok('salesman', 'PATCH', `${A}/visits/{id}`, {
      params: { id: visitId },
      body: { status: 'visited' },
    });
    const shot = await ok('salesman', 'POST', `${A}/visits/{id}/photos`, {
      params: { id: visitId },
      fields: { note: 'Shelf' },
      files: [['photo', await photo()]],
    });
    const photoKey: string = shot.body.imageKey;

    const sale = await ok('salesman', 'POST', `${A}/sales`, {
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        clientId: newShopId,
        visitId,
        items: [{ productId: product.id, unit: 'base', quantity: 2 }],
      },
    });
    const saleId: string = sale.body.id;
    const toCancel = await ok('salesman', 'POST', `${A}/sales`, {
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        clientId: newShopId,
        visitId,
        items: [{ productId: product.id, unit: 'base', quantity: 1 }],
      },
    });
    await ok('salesman', 'POST', `${A}/sales/{id}/cancel`, {
      params: { id: toCancel.body.id },
      body: { reason: 'Entered twice' },
    });
    const payment = await ok('salesman', 'POST', `${A}/payments`, {
      headers: { 'Idempotency-Key': randomUUID() },
      fields: {
        clientId: newShopId,
        method: 'cheque',
        amountPaisa: 1000,
        chequeNumber: 'WALK-1',
      },
      files: [['cheque_front', await photo()]],
    });
    const paymentId: string = payment.body.id;
    await ok('manager', 'PATCH', `${A}/payments/{id}/status`, {
      params: { id: paymentId },
      body: { status: 'confirmed' },
    });
    const ret = await ok('salesman', 'POST', `${A}/returns`, {
      body: {
        clientId: newShopId,
        saleId,
        items: [
          {
            productId: product.id,
            unit: 'base',
            quantity: 1,
            reason: 'damaged',
          },
        ],
      },
    });
    const writeOff = await ok('salesman', 'POST', `${A}/write-offs`, {
      body: {
        productId: product.id,
        unit: 'base',
        quantity: 1,
        reason: 'damaged',
      },
    });
    const expense = await ok('salesman', 'POST', `${A}/expenses`, {
      fields: { type: 'fuel', amountPaisa: 50_000 },
      files: [['receipt', await photo()]],
    });
    await ok('manager', 'PATCH', `${A}/expenses/{id}`, {
      params: { id: expense.body.id },
      body: { description: 'Petrol' },
    });

    // ---------- every read, as every caller ----------
    const fill: Record<string, string> = {
      [`${A}/files/{key}`]: photoKey,
      [`${A}/staff/{id}`]: staffId,
      [`${A}/products/{id}`]: product.id,
      [`${A}/routes/{id}`]: seeded.routeId,
      [`${A}/sales/{id}`]: saleId,
      [`${A}/payments/{id}`]: paymentId,
      [`${A}/returns/{id}`]: ret.body.id,
      [`${A}/write-offs/{id}`]: writeOff.body.id,
      [`${A}/visits/{id}/photos`]: visitId,
    };
    const idFor = (path: string) =>
      fill[path] ??
      (path.startsWith(`${A}/clients/`)
        ? newShopId
        : path.startsWith(`${A}/day-plans/`)
          ? planId
          : path.startsWith(`${A}/reports/salesman/`)
            ? salesman.id
            : undefined);
    const ranged = { from: today, to: today };
    const reads = async () => {
      for (const route of routes.filter((r) => r.startsWith('GET '))) {
        const path = route.slice(4);
        const value = idFor(path);
        for (const who of [
          'owner',
          'manager',
          'salesman',
          'shop',
          'anonymous',
        ] as const) {
          await call(who, 'GET', path, {
            params: value ? { id: value, key: value } : {},
            query: path.match(/summary|history|analytics/) ? ranged : {},
          });
        }
      }
    };
    await reads(); // mid-day, while the plan is in progress

    // ---------- closing the day ----------
    const left = await ok('salesman', 'GET', `${A}/day-plans/{id}`, {
      params: { id: planId },
    });
    for (const v of left.body.visits as { id: string; status: string }[]) {
      if (v.status === 'planned') {
        await ok('salesman', 'PATCH', `${A}/visits/{id}`, {
          params: { id: v.id },
          body: { status: 'skipped' },
        });
      }
    }
    // 20 issued, 2 sold (the cancelled sale freed its 1), 1 written off.
    await ok('salesman', 'POST', `${A}/day-plans/{id}/close`, {
      params: { id: planId },
      body: {
        cashHandedOverPaisa: 0,
        returned: [
          { productId: product.id, unit: 'base', quantityReturned: 17 },
        ],
      },
    });
    await ok('manager', 'POST', `${A}/day-plans/{id}/reconcile`, {
      params: { id: planId },
      body: {
        counted: [{ productId: product.id, unit: 'base', quantityCounted: 17 }],
      },
    });
    await reads(); // again, with the day reconciled

    // ---------- the rest: password change, deletes ----------
    await ok('shop', 'POST', `${A}/auth/change-password`, {
      body: {
        currentPassword: login('shop', 'shop').password,
        newPassword: 'NewShop@12345',
      },
    });
    await ok('manager', 'DELETE', `${A}/product-categories/{id}`, {
      params: { id: categoryId },
    });
    await ok('manager', 'DELETE', `${A}/day-plans/{id}`, {
      params: { id: spare.body.id },
    });
    // The spare plan really went, and the shop it was for still exists.
    expect(
      await db
        .select({ id: retailClients.id })
        .from(retailClients)
        .where(
          and(
            eq(retailClients.id, shop.id),
            eq(retailClients.businessId, seeded.businessId),
          ),
        ),
    ).toHaveLength(1);

    expect(violations).toEqual([]);
    const missed = routes.filter((r) => !answered.has(r));
    expect(missed).toEqual([]);
  }, 120_000);
});
