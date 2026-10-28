import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { asc, eq } from 'drizzle-orm';
import request, { Response } from 'supertest';
import { Database } from '../src/database/database.types.js';
import {
  retailClients,
  routeClients,
  routes,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import {
  expectNoSecrets,
  resetThrottle,
  shopToken,
  staffToken,
} from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type Client = typeof retailClients.$inferSelect;
type Route = typeof routes.$inferSelect;

const CLIENTS = '/api/v1/clients';
const ROUTES = '/api/v1/routes';
const SHOP_ME = '/api/v1/shop/me';
const SHOP_LOGIN = '/api/v1/auth/shop/login';

describe('Routes and shops (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let shops: Client[]; // business A's seeded shops, in route order
  let b: { route: Route; shop: Client };
  const tokens = {} as Record<
    'aOwner' | 'aManager' | 'aSalesman' | 'aShop' | 'bOwner' | 'bShop',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
    put: (url: string, body: object) =>
      http().put(url).auth(token, { type: 'bearer' }).send(body),
  });
  const clientRow = async (id: string) =>
    (await db.select().from(retailClients).where(eq(retailClients.id, id)))[0];
  const storedStops = (routeId: string) =>
    db
      .select({
        clientId: routeClients.clientId,
        sequence: routeClients.sequence,
      })
      .from(routeClients)
      .where(eq(routeClients.routeId, routeId))
      .orderBy(asc(routeClients.sequence));
  const newShop = (overrides: object = {}) => ({
    name: 'Teku Fancy Store',
    email: `${randomUUID()}@shop.test`,
    password: 'Temp@12345',
    ownerName: 'Ram Shah',
    phone: '9841000000',
    ...overrides,
  });
  const ids = (res: Response) =>
    (res.body.data ?? res.body.clients).map((c: { id: string }) => c.id);

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  beforeEach(async () => {
    await truncateAll(db);
    resetThrottle(app);
    seeded = await seed(db);
    const staff = await db
      .select()
      .from(users)
      .where(eq(users.businessId, seeded.businessId));
    const byRole = (r: string) => staff.find((u) => u.role === r)!;
    tokens.aOwner = await staffToken(app, byRole('owner'));
    tokens.aManager = await staffToken(app, byRole('manager'));
    tokens.aSalesman = await staffToken(app, byRole('salesman'));
    shops = (
      await db
        .select({ client: retailClients })
        .from(retailClients)
        .innerJoin(routeClients, eq(routeClients.clientId, retailClients.id))
        .where(eq(routeClients.routeId, seeded.routeId))
        .orderBy(asc(routeClients.sequence))
    ).map((r) => r.client);
    tokens.aShop = await shopToken(app, shops[0]);

    const bBusiness = await insertBusiness(db, { name: 'Other Traders' });
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, bBusiness.id, { role: 'owner' }),
    );
    const [bShop] = await db
      .insert(retailClients)
      .values({
        id: randomUUID(),
        businessId: bBusiness.id,
        name: 'B Secret Shop',
        email: 'bshop@other.test',
        panNumber: '301000001', // same PAN as an A shop: fine across businesses
        passwordHash: 'x',
        creditLimitPaisa: 777,
        createdAt: new Date(),
      })
      .returning();
    const [bRoute] = await db
      .insert(routes)
      .values({
        id: randomUUID(),
        businessId: bBusiness.id,
        name: 'B Route',
        createdAt: new Date(),
      })
      .returning();
    await db
      .insert(routeClients)
      .values({ routeId: bRoute.id, clientId: bShop.id, sequence: 0 });
    b = { route: bRoute, shop: bShop };
    tokens.bShop = await shopToken(app, bShop);
  });
  afterAll(() => app.close());

  describe('creating shops', () => {
    it('manager creates a shop with credit terms; it can log in', async () => {
      const body = newShop({
        email: '  New.Shop@Shop.TEST ',
        panNumber: '302000001',
        creditLimitPaisa: 2_500_000,
        openingBalancePaisa: 120_000,
        lat: 27.7,
        lng: 85.3,
      });
      const res = await as(tokens.aManager).post(CLIENTS, body).expect(201);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        email: 'new.shop@shop.test',
        panNumber: '302000001',
        creditLimitPaisa: 2_500_000,
        openingBalancePaisa: 120_000,
        isActive: true,
      });

      const row = await clientRow(res.body.id);
      expect(row.businessId).toBe(seeded.businessId);
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      await http()
        .post(SHOP_LOGIN)
        .send({ email: 'new.shop@shop.test', password: body.password })
        .expect(200);
    });

    it('returns 409 for a duplicate shop email, in any case and any business', async () => {
      for (const email of [
        shops[0].email,
        shops[0].email.toUpperCase(),
        b.shop.email,
      ]) {
        const res = await as(tokens.aManager)
          .post(CLIENTS, newShop({ email }))
          .expect(409);
        expect(res.body.error).toMatchObject({
          code: 'EMAIL_TAKEN',
          message: 'A shop with this email already exists',
        });
      }
      const res = await as(tokens.aManager)
        .patch(`${CLIENTS}/${shops[1].id}`, { email: shops[0].email })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('a salesman-created shop gets zero credit and opening balance whatever he sends', async () => {
      const res = await as(tokens.aSalesman)
        .post(
          CLIENTS,
          newShop({
            creditLimitPaisa: 9_000_000,
            openingBalancePaisa: -50_000,
            isActive: false,
          }),
        )
        .expect(201);
      expect(res.body).toMatchObject({
        creditLimitPaisa: 0,
        openingBalancePaisa: 0,
        isActive: true,
      });
      expect(await clientRow(res.body.id)).toMatchObject({
        creditLimitPaisa: 0,
        openingBalancePaisa: 0,
        isActive: true,
      });
    });

    it('requires an email and a temporary password of 8+ characters', async () => {
      for (const body of [
        newShop({ email: undefined }),
        newShop({ password: undefined }),
        newShop({ password: 'short' }),
      ]) {
        const res = await as(tokens.aManager).post(CLIENTS, body).expect(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it.each([
      ['a short PAN', { panNumber: '12345678' }],
      ['a PAN with letters', { panNumber: '30100000A' }],
      ['a negative credit limit', { creditLimitPaisa: -1 }],
      ['a fractional opening balance', { openingBalancePaisa: 1.5 }],
      ['an out-of-range latitude', { lat: 91 }],
      ['an unknown field', { businessId: randomUUID() }],
    ])('rejects %s', async (_label, overrides) => {
      await as(tokens.aManager).post(CLIENTS, newShop(overrides)).expect(400);
    });

    it('PAN is optional and unique only within the business', async () => {
      await as(tokens.aManager).post(CLIENTS, newShop()).expect(201);
      await as(tokens.aManager)
        .post(CLIENTS, newShop({ panNumber: null }))
        .expect(201);
      const dup = await as(tokens.aManager)
        .post(CLIENTS, newShop({ panNumber: shops[0].panNumber }))
        .expect(409);
      expect(dup.body.error.code).toBe('PAN_TAKEN');
      // B already holds A's PAN 301000001 (see beforeEach), and B can add another.
      await as(tokens.bOwner)
        .post(CLIENTS, newShop({ panNumber: shops[1].panNumber }))
        .expect(201);
    });
  });

  describe('updating shops', () => {
    it('manager can change credit terms and deactivate', async () => {
      const res = await as(tokens.aManager)
        .patch(`${CLIENTS}/${shops[0].id}`, {
          creditLimitPaisa: 100,
          openingBalancePaisa: 200,
          isActive: false,
          panNumber: null,
        })
        .expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        creditLimitPaisa: 100,
        openingBalancePaisa: 200,
        isActive: false,
        panNumber: null,
      });
    });

    it('salesman can edit contact details but not credit terms or status', async () => {
      await as(tokens.aSalesman)
        .patch(`${CLIENTS}/${shops[0].id}`, { phone: '9851111111' })
        .expect(200);
      for (const body of [
        { creditLimitPaisa: 1 },
        { openingBalancePaisa: 1 },
        { isActive: false },
      ]) {
        const res = await as(tokens.aSalesman)
          .patch(`${CLIENTS}/${shops[0].id}`, { phone: '9852222222', ...body })
          .expect(403);
        expect(res.body.error.code).toBe('FIELD_NOT_ALLOWED');
      }
      expect(await clientRow(shops[0].id)).toMatchObject({
        phone: '9851111111',
        creditLimitPaisa: shops[0].creditLimitPaisa,
        isActive: true,
      });
    });

    it('rejects null for required fields and a password change via PATCH', async () => {
      const url = `${CLIENTS}/${shops[0].id}`;
      await as(tokens.aManager).patch(url, { name: null }).expect(400);
      await as(tokens.aManager).patch(url, { email: null }).expect(400);
      await as(tokens.aManager)
        .patch(url, { creditLimitPaisa: null })
        .expect(400);
      await as(tokens.aManager)
        .patch(url, { password: 'Another@123' })
        .expect(400);
    });
  });

  describe('listing and reading shops', () => {
    it('lists the business’s shops without password hashes', async () => {
      const res = await as(tokens.aSalesman).get(CLIENTS).expect(200);
      expectNoSecrets(res);
      expect(res.body.total).toBe(3);
      expect(ids(res).sort()).toEqual(shops.map((s) => s.id).sort());
    });

    it.each([
      ['name', 'kirana', 0],
      ['owner name', 'sita', 1],
      ['email', 'shop3@', 2],
      ['PAN', '301000002', 1],
    ])('searches by %s', async (_label, search, index) => {
      const res = await as(tokens.aOwner)
        .get(`${CLIENTS}?search=${encodeURIComponent(search)}`)
        .expect(200);
      expect(ids(res)).toEqual([shops[index].id]);
    });

    it('filters by route, in route order', async () => {
      const [other] = await db
        .insert(routes)
        .values({
          id: randomUUID(),
          businessId: seeded.businessId,
          name: 'Other route',
          createdAt: new Date(),
        })
        .returning();
      await as(tokens.aOwner)
        .put(`${ROUTES}/${other.id}/clients`, {
          clientIds: [shops[2].id, shops[0].id],
        })
        .expect(200);
      const res = await as(tokens.aSalesman)
        .get(`${CLIENTS}?routeId=${other.id}`)
        .expect(200);
      expect(res.body.total).toBe(2);
      expect(ids(res)).toEqual([shops[2].id, shops[0].id]);
    });

    it('reads one shop', async () => {
      const res = await as(tokens.aSalesman)
        .get(`${CLIENTS}/${shops[1].id}`)
        .expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        id: shops[1].id,
        name: 'Balkhu General Store',
        creditLimitPaisa: 5_000_000,
      });
    });
  });

  describe('POST /clients/:id/reset-password', () => {
    it('manager sets a temporary password', async () => {
      await as(tokens.aManager)
        .post(`${CLIENTS}/${shops[0].id}/reset-password`, {
          temporaryPassword: 'Fresh@12345',
        })
        .expect(204);
      const row = await clientRow(shops[0].id);
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await argon2.verify(row.passwordHash, 'Fresh@12345')).toBe(true);
      await http()
        .post(SHOP_LOGIN)
        .send({ email: shops[0].email, password: 'Fresh@12345' })
        .expect(200);
    });

    it('salesmen cannot reset a shop password', async () => {
      await as(tokens.aSalesman)
        .post(`${CLIENTS}/${shops[0].id}/reset-password`, {
          temporaryPassword: 'Fresh@12345',
        })
        .expect(403);
    });
  });

  describe('routes', () => {
    it('saves the stop order and returns it in order', async () => {
      const order = [shops[2].id, shops[0].id, shops[1].id];
      const put = await as(tokens.aManager)
        .put(`${ROUTES}/${seeded.routeId}/clients`, { clientIds: order })
        .expect(200);
      expectNoSecrets(put);
      expect(ids(put)).toEqual(order);
      expect(
        put.body.clients.map((c: { sequence: number }) => c.sequence),
      ).toEqual([0, 1, 2]);

      const get = await as(tokens.aSalesman)
        .get(`${ROUTES}/${seeded.routeId}`)
        .expect(200);
      expect(ids(get)).toEqual(order);
      expect(await storedStops(seeded.routeId)).toEqual(
        order.map((clientId, sequence) => ({ clientId, sequence })),
      );
    });

    it('replaces the whole list, including down to empty', async () => {
      await as(tokens.aOwner)
        .put(`${ROUTES}/${seeded.routeId}/clients`, {
          clientIds: [shops[1].id],
        })
        .expect(200);
      expect(await storedStops(seeded.routeId)).toEqual([
        { clientId: shops[1].id, sequence: 0 },
      ]);
      const empty = await as(tokens.aOwner)
        .put(`${ROUTES}/${seeded.routeId}/clients`, { clientIds: [] })
        .expect(200);
      expect(empty.body.clients).toEqual([]);
      expect(await storedStops(seeded.routeId)).toEqual([]);
    });

    it('applies all or nothing: one bad id leaves the route unchanged', async () => {
      const before = await storedStops(seeded.routeId);
      for (const bad of [b.shop.id, randomUUID()]) {
        const res = await as(tokens.aOwner)
          .put(`${ROUTES}/${seeded.routeId}/clients`, {
            clientIds: [shops[2].id, bad],
          })
          .expect(404);
        expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
      }
      expect(await storedStops(seeded.routeId)).toEqual(before);
    });

    it('rejects duplicate or malformed ids', async () => {
      for (const clientIds of [
        [shops[0].id, shops[0].id],
        ['not-a-uuid'],
        'nope',
      ]) {
        await as(tokens.aOwner)
          .put(`${ROUTES}/${seeded.routeId}/clients`, { clientIds })
          .expect(400);
      }
    });

    it('serialises concurrent replacements', async () => {
      const orders = [
        [shops[0].id, shops[1].id],
        [shops[2].id],
        [shops[1].id, shops[2].id, shops[0].id],
      ];
      const results = await Promise.all(
        orders.map((clientIds) =>
          as(tokens.aOwner).put(`${ROUTES}/${seeded.routeId}/clients`, {
            clientIds,
          }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      const final = (await storedStops(seeded.routeId)).map((s) => s.clientId);
      expect(orders).toContainEqual(final);
    });

    it('creates, renames and deactivates a route', async () => {
      const created = await as(tokens.aManager)
        .post(ROUTES, { name: 'Teku - Tripureshwor' })
        .expect(201);
      expect(created.body).toMatchObject({ isActive: true, clients: [] });
      const dup = await as(tokens.aManager)
        .post(ROUTES, { name: 'Kalimati - Balkhu' })
        .expect(409);
      expect(dup.body.error.code).toBe('ROUTE_NAME_TAKEN');

      const updated = await as(tokens.aManager)
        .patch(`${ROUTES}/${created.body.id}`, {
          name: 'Teku Loop',
          isActive: false,
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        name: 'Teku Loop',
        isActive: false,
      });

      const active = await as(tokens.aSalesman)
        .get(`${ROUTES}?isActive=true`)
        .expect(200);
      expect(active.body).toEqual([
        expect.objectContaining({
          id: seeded.routeId,
          clientCount: 3,
        }),
      ]);
    });

    it('salesmen can read routes but not change them', async () => {
      await as(tokens.aSalesman).get(ROUTES).expect(200);
      await as(tokens.aSalesman).post(ROUTES, { name: 'X' }).expect(403);
      await as(tokens.aSalesman)
        .patch(`${ROUTES}/${seeded.routeId}`, { isActive: false })
        .expect(403);
      await as(tokens.aSalesman)
        .put(`${ROUTES}/${seeded.routeId}/clients`, { clientIds: [] })
        .expect(403);
    });
  });

  describe('GET /shop/me and shop tokens', () => {
    it('returns the shop’s own record only', async () => {
      const res = await as(tokens.aShop).get(SHOP_ME).expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        id: shops[0].id,
        name: 'Kalimati Kirana Pasal',
        creditLimitPaisa: 5_000_000,
        business: { id: seeded.businessId, name: 'Asva Traders' },
      });
      const other = await as(tokens.bShop).get(SHOP_ME).expect(200);
      expect(other.body.id).toBe(b.shop.id);
    });

    it('a shop token cannot read any shop record through the staff routes', async () => {
      const responses = [
        await as(tokens.aShop).get(CLIENTS),
        await as(tokens.aShop).get(`${CLIENTS}/${shops[1].id}`),
        await as(tokens.aShop).get(`${CLIENTS}/${shops[0].id}`),
        await as(tokens.aShop).get(`${CLIENTS}/${b.shop.id}`),
        await as(tokens.aShop).patch(`${CLIENTS}/${shops[1].id}`, {
          name: 'Pwned',
        }),
        await as(tokens.aShop).get(`${ROUTES}/${seeded.routeId}`),
      ];
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.text).not.toContain(shops[1].name);
        expect(res.text).not.toContain(b.shop.name);
      }
      expect((await clientRow(shops[1].id)).name).toBe('Balkhu General Store');
    });

    it('/shop/me takes no id, and staff tokens are refused', async () => {
      await as(tokens.aShop).get(`${SHOP_ME}/${shops[1].id}`).expect(404);
      await as(tokens.aOwner).get(SHOP_ME).expect(403);
    });

    it('a deactivated shop loses access at once', async () => {
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.id, shops[0].id));
      await as(tokens.aShop).get(SHOP_ME).expect(401);
    });
  });

  describe('tenant isolation', () => {
    it('business A cannot read, change or reset business B’s shop', async () => {
      const url = `${CLIENTS}/${b.shop.id}`;
      const responses = [
        await as(tokens.aSalesman).get(url),
        await as(tokens.aOwner).get(url),
        await as(tokens.aOwner).patch(url, { creditLimitPaisa: 0 }),
        await as(tokens.aOwner).post(`${url}/reset-password`, {
          temporaryPassword: 'Pwned@12345',
        }),
      ];
      for (const res of responses) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
      }
      expect(await clientRow(b.shop.id)).toMatchObject({
        creditLimitPaisa: 777,
        passwordHash: 'x',
      });
    });

    it('business A cannot read or change business B’s route', async () => {
      const url = `${ROUTES}/${b.route.id}`;
      const responses = [
        await as(tokens.aSalesman).get(url),
        await as(tokens.aOwner).patch(url, { name: 'Pwned' }),
        await as(tokens.aOwner).put(`${url}/clients`, { clientIds: [] }),
        await as(tokens.aOwner).put(`${url}/clients`, {
          clientIds: [shops[0].id],
        }),
      ];
      for (const res of responses) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
      }
      expect(await storedStops(b.route.id)).toEqual([
        { clientId: b.shop.id, sequence: 0 },
      ]);
    });

    it('lists and filters never include business B', async () => {
      const all = await as(tokens.aOwner).get(`${CLIENTS}?limit=100`);
      expect(all.text).not.toContain(b.shop.id);
      const search = await as(tokens.aOwner).get(`${CLIENTS}?search=secret`);
      expect(search.body.total).toBe(0);
      const byBRoute = await as(tokens.aOwner).get(
        `${CLIENTS}?routeId=${b.route.id}`,
      );
      expect(byBRoute.body.total).toBe(0);
      const routeList = await as(tokens.aOwner).get(ROUTES);
      expect(routeList.text).not.toContain(b.route.id);
    });

    it('shops created by A belong to A', async () => {
      const res = await as(tokens.aSalesman).post(CLIENTS, newShop());
      expect((await clientRow(res.body.id)).businessId).toBe(seeded.businessId);
    });
  });
});
