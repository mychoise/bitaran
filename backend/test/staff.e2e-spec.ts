import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { hashPassword } from '../src/auth/password.js';
import { nepalToday } from '../src/common/utils/date.util.js';
import { Database } from '../src/database/database.types.js';
import {
  businesses,
  dayPlans,
  retailClients,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { expectNoSecrets, resetThrottle, staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;

const STAFF = '/api/v1/staff';
const BUSINESS = '/api/v1/business';
const STAFF_LOGIN = '/api/v1/auth/staff/login';
const B_PASSWORD = 'Other@12345';

describe('Business and staff (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;

  // Business A is the seed; business B is a second tenant built here.
  let a: { owner: User; manager: User; salesman: User; salesman2: User };
  let b: { businessId: string; owner: User; salesman: User };
  const tokens = {} as Record<
    'aOwner' | 'aManager' | 'aSalesman' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  const userById = async (id: string) =>
    (await db.select().from(users).where(eq(users.id, id)))[0];
  const newStaff = (role: string) => ({
    fullName: 'New Person',
    email: `${randomUUID()}@asva.test`,
    phone: '9800000099',
    role,
    password: 'Initial@123',
  });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  beforeEach(async () => {
    await truncateAll(db);
    resetThrottle(app);
    seeded = await seed(db);

    const aStaff = await db
      .select()
      .from(users)
      .where(eq(users.businessId, seeded.businessId));
    const byEmail = (e: string) => aStaff.find((u) => u.email === e)!;
    a = {
      owner: byEmail('owner@asva.test'),
      manager: byEmail('manager@asva.test'),
      salesman: byEmail('salesman1@asva.test'),
      salesman2: byEmail('salesman2@asva.test'),
    };

    const bBusiness = await insertBusiness(db, { name: 'Other Traders' });
    const passwordHash = await hashPassword(B_PASSWORD);
    b = {
      businessId: bBusiness.id,
      owner: await insertUser(db, bBusiness.id, {
        role: 'owner',
        passwordHash,
      }),
      salesman: await insertUser(db, bBusiness.id, {
        role: 'salesman',
        fullName: 'B Salesman',
        passwordHash,
      }),
    };

    tokens.aOwner = await staffToken(app, a.owner);
    tokens.aManager = await staffToken(app, a.manager);
    tokens.aSalesman = await staffToken(app, a.salesman);
    tokens.bOwner = await staffToken(app, b.owner);
  });
  afterAll(() => app.close());

  describe('GET /business', () => {
    it.each(['aOwner', 'aManager', 'aSalesman'] as const)(
      'returns the caller’s own business for %s',
      async (who) => {
        const res = await as(tokens[who]).get(BUSINESS).expect(200);
        expect(res.body).toMatchObject({
          id: seeded.businessId,
          name: 'Asva Traders',
          panNumber: '609876543',
        });
      },
    );

    it('is staff only', async () => {
      const [shop] = await db.select().from(retailClients).limit(1);
      const token = await app
        .get(JwtService)
        .signAsync({ type: 'shop', sub: shop.id });
      await as(token).get(BUSINESS).expect(403);
    });
  });

  describe('PATCH /business', () => {
    const changes = {
      name: 'Asva Traders Pvt Ltd',
      phone: '014270001',
      email: 'Hello@Asva.test',
      address: 'Teku, Kathmandu',
      city: 'Lalitpur',
      registrationNumber: 'REG-42',
      logoKey: 'logos/asva.png',
    };

    it('lets the owner update the editable fields', async () => {
      const res = await as(tokens.aOwner).patch(BUSINESS, changes).expect(200);
      expect(res.body).toMatchObject({
        ...changes,
        email: 'hello@asva.test',
        panNumber: '609876543',
      });
    });

    it.each(['aManager', 'aSalesman'] as const)('rejects %s', async (who) => {
      await as(tokens[who]).patch(BUSINESS, { name: 'Hijacked' }).expect(403);
      const [row] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, seeded.businessId));
      expect(row.name).toBe('Asva Traders');
    });

    it('refuses to change the PAN', async () => {
      const res = await as(tokens.aOwner)
        .patch(BUSINESS, { panNumber: '601111111' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      const [row] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, seeded.businessId));
      expect(row.panNumber).toBe('609876543');
    });

    it('rejects null for required fields but clears nullable ones', async () => {
      await as(tokens.aOwner).patch(BUSINESS, { name: null }).expect(400);
      await as(tokens.aOwner).patch(BUSINESS, { address: '  ' }).expect(400);
      const res = await as(tokens.aOwner)
        .patch(BUSINESS, { email: null, city: null, logoKey: null })
        .expect(200);
      expect(res.body).toMatchObject({
        email: null,
        city: null,
        logoKey: null,
      });
    });

    it('changes only the caller’s business', async () => {
      await as(tokens.bOwner)
        .patch(BUSINESS, { name: 'B Renamed' })
        .expect(200);
      const [aRow] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, seeded.businessId));
      expect(aRow.name).toBe('Asva Traders');
    });
  });

  describe('creating staff', () => {
    it.each(['manager', 'salesman'])(
      'owner can create a %s who can then log in',
      async (role) => {
        const body = newStaff(role);
        const res = await as(tokens.aOwner).post(STAFF, body).expect(201);
        expectNoSecrets(res);
        expect(res.body).toMatchObject({
          role,
          email: body.email,
          isActive: true,
        });
        const row = await userById(res.body.id);
        expect(row.businessId).toBe(seeded.businessId);
        expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
        await http()
          .post(STAFF_LOGIN)
          .send({ email: body.email, password: body.password })
          .expect(200);
      },
    );

    it('manager can create a salesman', async () => {
      await as(tokens.aManager).post(STAFF, newStaff('salesman')).expect(201);
    });

    it('manager cannot create a manager', async () => {
      const res = await as(tokens.aManager)
        .post(STAFF, newStaff('manager'))
        .expect(403);
      expect(res.body.error).toMatchObject({
        code: 'ROLE_NOT_ALLOWED',
        message: 'You cannot assign the manager role',
      });
    });

    it.each(['aOwner', 'aManager'] as const)(
      'rejects a second owner with a clear error (%s)',
      async (who) => {
        const res = await as(tokens[who])
          .post(STAFF, newStaff('owner'))
          .expect(409);
        expect(res.body.error).toMatchObject({
          code: 'SECOND_OWNER',
          message:
            'A business has exactly one owner; another owner cannot be added',
        });
        const owners = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.businessId, seeded.businessId),
              eq(users.role, 'owner'),
            ),
          );
        expect(owners).toHaveLength(1);
      },
    );

    it('rejects promoting someone to owner', async () => {
      const res = await as(tokens.aOwner)
        .patch(`${STAFF}/${a.manager.id}`, { role: 'owner' })
        .expect(409);
      expect(res.body.error.code).toBe('SECOND_OWNER');
    });

    it('salesmen cannot use the staff routes', async () => {
      await as(tokens.aSalesman).get(STAFF).expect(403);
      await as(tokens.aSalesman).post(STAFF, newStaff('salesman')).expect(403);
      await as(tokens.aSalesman).get(`${STAFF}/${a.salesman.id}`).expect(403);
    });

    it('rejects an email already used, in any business', async () => {
      for (const email of [a.salesman.email, b.salesman.email]) {
        const res = await as(tokens.aOwner)
          .post(STAFF, { ...newStaff('salesman'), email })
          .expect(409);
        expect(res.body.error.code).toBe('EMAIL_TAKEN');
      }
    });

    it('validates the body', async () => {
      const res = await as(tokens.aOwner)
        .post(STAFF, { ...newStaff('salesman'), password: 'short' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      await as(tokens.aOwner)
        .post(STAFF, { ...newStaff('salesman'), businessId: b.businessId })
        .expect(400);
    });
  });

  describe('listing and reading staff', () => {
    it('lists only the caller’s business, without password hashes', async () => {
      const res = await as(tokens.aManager).get(STAFF).expect(200);
      expectNoSecrets(res);
      expect(res.body.total).toBe(4);
      expect(res.body.data.map((u: User) => u.id).sort()).toEqual(
        [a.owner.id, a.manager.id, a.salesman.id, a.salesman2.id].sort(),
      );
    });

    it('filters by role and active state, and paginates', async () => {
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, a.salesman2.id));
      const active = await as(tokens.aOwner)
        .get(`${STAFF}?role=salesman&isActive=true`)
        .expect(200);
      expect(active.body.data.map((u: User) => u.id)).toEqual([a.salesman.id]);

      const page = await as(tokens.aOwner)
        .get(`${STAFF}?page=2&limit=3`)
        .expect(200);
      expect(page.body).toMatchObject({ page: 2, limit: 3, total: 4 });
      expect(page.body.data).toHaveLength(1);
    });

    it('reads one staff member', async () => {
      const res = await as(tokens.aOwner)
        .get(`${STAFF}/${a.salesman.id}`)
        .expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        id: a.salesman.id,
        fullName: 'Suman Gurung',
        role: 'salesman',
      });
    });

    it('rejects a malformed id', async () => {
      await as(tokens.aOwner).get(`${STAFF}/not-a-uuid`).expect(400);
    });
  });

  describe('updating staff', () => {
    it('owner can edit, promote and demote non-owners', async () => {
      const res = await as(tokens.aOwner)
        .patch(`${STAFF}/${a.salesman.id}`, {
          fullName: 'Suman G.',
          phone: null,
          role: 'manager',
        })
        .expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        fullName: 'Suman G.',
        phone: null,
        role: 'manager',
      });
      await as(tokens.aOwner)
        .patch(`${STAFF}/${a.manager.id}`, { role: 'salesman' })
        .expect(200);
    });

    it('manager can edit and deactivate a salesman, but not change roles', async () => {
      await as(tokens.aManager)
        .patch(`${STAFF}/${a.salesman.id}`, { phone: '9811111111' })
        .expect(200);
      const res = await as(tokens.aManager)
        .patch(`${STAFF}/${a.salesman.id}`, { role: 'manager' })
        .expect(403);
      expect(res.body.error.code).toBe('ROLE_NOT_ALLOWED');
      expect((await userById(a.salesman.id)).role).toBe('salesman');
    });

    it('manager cannot touch the owner or another manager', async () => {
      const otherManager = await insertUser(db, seeded.businessId, {
        role: 'manager',
      });
      for (const id of [a.owner.id, otherManager.id]) {
        const res = await as(tokens.aManager)
          .patch(`${STAFF}/${id}`, { isActive: false })
          .expect(403);
        expect(res.body.error.code).toBe('STAFF_NOT_MANAGEABLE');
      }
    });

    it('the owner cannot be deactivated or demoted', async () => {
      for (const body of [{ isActive: false }, { role: 'manager' }]) {
        const res = await as(tokens.aOwner)
          .patch(`${STAFF}/${a.owner.id}`, body)
          .expect(403);
        expect(res.body.error.code).toBe('OWNER_PROTECTED');
      }
      const owner = await userById(a.owner.id);
      expect(owner).toMatchObject({ role: 'owner', isActive: true });
    });

    it('the owner can still edit their own contact details', async () => {
      const res = await as(tokens.aOwner)
        .patch(`${STAFF}/${a.owner.id}`, { fullName: 'Asha S.' })
        .expect(200);
      expect(res.body).toMatchObject({ fullName: 'Asha S.', role: 'owner' });
    });

    it('rejects changing an email to one already in use', async () => {
      const res = await as(tokens.aOwner)
        .patch(`${STAFF}/${a.salesman.id}`, { email: a.salesman2.email })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('deactivation', () => {
    it('a deactivated staff member can no longer log in', async () => {
      const login = () =>
        http()
          .post(STAFF_LOGIN)
          .send({ email: a.salesman.email, password: 'Salesman@12345' });
      await login().expect(200);

      await as(tokens.aManager)
        .patch(`${STAFF}/${a.salesman.id}`, { isActive: false })
        .expect(200);

      const res = await login().expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
      // Tokens issued before deactivation stop working too.
      await as(tokens.aSalesman).get(BUSINESS).expect(401);
    });

    it('keeps the row and its history, and can be reactivated', async () => {
      const [plan] = await db
        .insert(dayPlans)
        .values({
          id: randomUUID(),
          businessId: seeded.businessId,
          salesmanId: a.salesman.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          assignedBy: a.manager.id,
          createdAt: new Date(),
        })
        .returning();

      await as(tokens.aOwner)
        .patch(`${STAFF}/${a.salesman.id}`, { isActive: false })
        .expect(200);
      const read = await as(tokens.aOwner)
        .get(`${STAFF}/${a.salesman.id}`)
        .expect(200);
      expect(read.body.isActive).toBe(false);
      const plans = await db
        .select()
        .from(dayPlans)
        .where(eq(dayPlans.id, plan.id));
      expect(plans).toHaveLength(1);

      await as(tokens.aOwner)
        .patch(`${STAFF}/${a.salesman.id}`, { isActive: true })
        .expect(200);
      await http()
        .post(STAFF_LOGIN)
        .send({ email: a.salesman.email, password: 'Salesman@12345' })
        .expect(200);
    });
  });

  describe('POST /staff/:id/reset-password', () => {
    it('owner sets a temporary password, hashed with argon2id', async () => {
      const res = await as(tokens.aOwner)
        .post(`${STAFF}/${a.manager.id}/reset-password`, {
          temporaryPassword: 'Temp@54321',
        })
        .expect(204);
      expectNoSecrets(res);

      const row = await userById(a.manager.id);
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await argon2.verify(row.passwordHash, 'Temp@54321')).toBe(true);
      await http()
        .post(STAFF_LOGIN)
        .send({ email: a.manager.email, password: 'Manager@12345' })
        .expect(401);
      await http()
        .post(STAFF_LOGIN)
        .send({ email: a.manager.email, password: 'Temp@54321' })
        .expect(200);
    });

    it('manager can reset a salesman', async () => {
      await as(tokens.aManager)
        .post(`${STAFF}/${a.salesman.id}/reset-password`, {
          temporaryPassword: 'Temp@54321',
        })
        .expect(204);
    });

    it('nobody can reset the owner, a peer, or themselves here', async () => {
      const cases: [string, string][] = [
        [tokens.aManager, a.owner.id],
        [tokens.aManager, a.manager.id],
        [tokens.aOwner, a.owner.id],
      ];
      for (const [token, id] of cases) {
        const res = await as(token)
          .post(`${STAFF}/${id}/reset-password`, {
            temporaryPassword: 'Temp@54321',
          })
          .expect(403);
        expect(res.body.error.code).toBe('STAFF_NOT_MANAGEABLE');
      }
    });

    it('requires a password of at least 8 characters', async () => {
      await as(tokens.aOwner)
        .post(`${STAFF}/${a.salesman.id}/reset-password`, {
          temporaryPassword: 'short',
        })
        .expect(400);
    });
  });

  describe('tenant isolation', () => {
    it('lists never include another business’s staff', async () => {
      const aList = await as(tokens.aOwner).get(STAFF).expect(200);
      expect(aList.body.data.map((u: User) => u.id)).not.toContain(
        b.salesman.id,
      );
      const bList = await as(tokens.bOwner).get(STAFF).expect(200);
      expect(bList.body.data.map((u: User) => u.id).sort()).toEqual(
        [b.owner.id, b.salesman.id].sort(),
      );
    });

    it.each(['aOwner', 'aManager'] as const)(
      '%s cannot read or change business B’s staff',
      async (who) => {
        const t = as(tokens[who]);
        const target = `${STAFF}/${b.salesman.id}`;
        const responses = [
          await t.get(target),
          await t.patch(target, { fullName: 'Pwned', isActive: false }),
          await t.post(`${target}/reset-password`, {
            temporaryPassword: 'Pwned@12345',
          }),
          await t.patch(`${STAFF}/${b.owner.id}`, { fullName: 'Pwned' }),
        ];
        // Indistinguishable from an id that does not exist.
        const missing = await t.get(`${STAFF}/${randomUUID()}`);
        for (const res of [...responses, missing]) {
          expect(res.status).toBe(404);
          expect(res.body.error.code).toBe('STAFF_NOT_FOUND');
        }

        const row = await userById(b.salesman.id);
        expect(row).toMatchObject({ fullName: 'B Salesman', isActive: true });
        expect(await argon2.verify(row.passwordHash, B_PASSWORD)).toBe(true);
        expect((await userById(b.owner.id)).fullName).toBe('Test User');
      },
    );

    it('staff created by A always belong to A', async () => {
      const res = await as(tokens.aOwner)
        .post(STAFF, newStaff('salesman'))
        .expect(201);
      expect((await userById(res.body.id)).businessId).toBe(seeded.businessId);
      const bList = await as(tokens.bOwner).get(STAFF).expect(200);
      expect(bList.body.total).toBe(2);
    });

    it('GET /business returns only the caller’s business', async () => {
      const res = await as(tokens.bOwner).get(BUSINESS).expect(200);
      expect(res.body).toMatchObject({
        id: b.businessId,
        name: 'Other Traders',
      });
    });
  });
});
