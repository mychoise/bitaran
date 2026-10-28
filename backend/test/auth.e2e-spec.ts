import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { LOGIN_THROTTLE } from '../src/auth/auth.module.js';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import type { TokenPayload } from '../src/common/decorators/current-user.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import {
  ShopOnly,
  StaffOnly,
} from '../src/common/decorators/user-type.decorator.js';
import { Database } from '../src/database/database.types.js';
import {
  businesses,
  retailClients,
  users,
} from '../src/database/schema/index.js';
import { seed, SeededLogin } from '../src/database/seed/seed.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { expectNoSecrets, resetThrottle } from './utils/auth.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

// Probe routes that exist only in this test, to exercise the guards.
@Controller('probe')
class ProbeController {
  @StaffOnly()
  @Get('staff')
  staff(@CurrentUser() user: TokenPayload) {
    return user;
  }

  @ShopOnly()
  @Get('shop')
  shop(@CurrentUser() user: TokenPayload) {
    return user;
  }

  @Roles('owner')
  @Get('owner')
  owner() {
    return { ok: true };
  }
}

const STAFF_LOGIN = '/api/v1/auth/staff/login';
const SHOP_LOGIN = '/api/v1/auth/shop/login';
const ME = '/api/v1/auth/me';
const CHANGE_PASSWORD = '/api/v1/auth/change-password';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let logins: SeededLogin[];
  let businessId: string;

  const http = () => request(app.getHttpServer());
  const loginOf = (role: string) => logins.find((l) => l.role === role)!;

  async function login(l: SeededLogin): Promise<string> {
    const res = await http()
      .post(l.type === 'staff' ? STAFF_LOGIN : SHOP_LOGIN)
      .send({ email: l.email, password: l.password })
      .expect(200);
    expectNoSecrets(res);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    ({ app, db } = await createTestApp([ProbeController]));
  });
  beforeEach(async () => {
    await truncateAll(db);
    ({ logins, businessId } = await seed(db));
    resetThrottle(app); // each test starts with a fresh login budget
  });
  afterAll(() => app.close());

  describe('login', () => {
    it.each(['owner', 'manager', 'salesman'])(
      'logs in the seeded %s as staff',
      async (role) => {
        const l = loginOf(role);
        const res = await http()
          .post(STAFF_LOGIN)
          .send({ email: l.email, password: l.password })
          .expect(200);
        expect(res.body).toMatchObject({
          accessToken: expect.any(String),
          tokenType: 'Bearer',
          expiresIn: '1d',
          profile: {
            type: 'staff',
            role,
            email: l.email,
            business: { id: businessId, name: 'Asva Traders' },
          },
        });
        const claims = app.get(JwtService).decode(res.body.accessToken);
        expect(claims).toMatchObject({ type: 'staff', role, businessId });
        expect(claims.exp - claims.iat).toBe(24 * 60 * 60);
      },
    );

    it('logs in a seeded shop', async () => {
      const l = loginOf('shop');
      const res = await http()
        .post(SHOP_LOGIN)
        .send({ email: l.email, password: l.password })
        .expect(200);
      expect(res.body.profile).toMatchObject({
        type: 'shop',
        email: l.email,
        business: { id: businessId },
      });
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      const l = loginOf('owner');
      await http()
        .post(STAFF_LOGIN)
        .send({ email: `  ${l.email.toUpperCase()} `, password: l.password })
        .expect(200);
    });

    it('records last_login_at', async () => {
      const before = new Date();
      await login(loginOf('salesman'));
      await login(loginOf('shop'));
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, loginOf('salesman').email));
      const [shop] = await db
        .select()
        .from(retailClients)
        .where(eq(retailClients.email, loginOf('shop').email));
      expect(user.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
      expect(shop.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
    });

    it('returns the same error for a wrong email and a wrong password', async () => {
      const l = loginOf('owner');
      const wrongPassword = await http()
        .post(STAFF_LOGIN)
        .send({ email: l.email, password: 'nope-nope' })
        .expect(401);
      const wrongEmail = await http()
        .post(STAFF_LOGIN)
        .send({ email: 'nobody@asva.test', password: l.password })
        .expect(401);
      expect(wrongEmail.body).toEqual(wrongPassword.body);
      expect(wrongPassword.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: [],
        },
      });
    });

    it('does not let staff log in on the shop route or the reverse', async () => {
      const staff = loginOf('owner');
      const shop = loginOf('shop');
      await http()
        .post(SHOP_LOGIN)
        .send({ email: staff.email, password: staff.password })
        .expect(401);
      await http()
        .post(STAFF_LOGIN)
        .send({ email: shop.email, password: shop.password })
        .expect(401);
    });

    it('rejects a malformed body', async () => {
      const res = await http()
        .post(STAFF_LOGIN)
        .send({ email: 'not-an-email' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('treats an unparseable stored hash as a wrong password, not a 500', async () => {
      const business = await insertBusiness(db);
      const user = await insertUser(db, business.id); // hash is 'x'
      await http()
        .post(STAFF_LOGIN)
        .send({ email: user.email, password: 'anything' })
        .expect(401);
    });
  });

  describe('inactive accounts', () => {
    it('rejects an inactive user', async () => {
      const l = loginOf('salesman');
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.email, l.email));
      const res = await http()
        .post(STAFF_LOGIN)
        .send({ email: l.email, password: l.password })
        .expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
      expectNoSecrets(res);
    });

    it('rejects an inactive shop', async () => {
      const l = loginOf('shop');
      await db
        .update(retailClients)
        .set({ isActive: false })
        .where(eq(retailClients.email, l.email));
      const res = await http()
        .post(SHOP_LOGIN)
        .send({ email: l.email, password: l.password })
        .expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('an inactive business blocks its staff and its shops', async () => {
      await db
        .update(businesses)
        .set({ isActive: false })
        .where(eq(businesses.id, businessId));
      for (const l of logins) {
        const res = await http()
          .post(l.type === 'staff' ? STAFF_LOGIN : SHOP_LOGIN)
          .send({ email: l.email, password: l.password });
        expect([res.status, res.body.error?.code]).toEqual([
          403,
          'ACCOUNT_INACTIVE',
        ]);
      }
    });

    it('still reports wrong credentials before revealing inactivity', async () => {
      const l = loginOf('salesman');
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.email, l.email));
      const res = await http()
        .post(STAFF_LOGIN)
        .send({ email: l.email, password: 'wrong-password' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('revokes existing tokens as soon as the user is deactivated', async () => {
      const token = await login(loginOf('salesman'));
      await http().get(ME).auth(token, { type: 'bearer' }).expect(200);
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.email, loginOf('salesman').email));
      await http().get(ME).auth(token, { type: 'bearer' }).expect(401);
    });

    it('revokes existing staff and shop tokens when the business is deactivated', async () => {
      const staff = await login(loginOf('owner'));
      const shop = await login(loginOf('shop'));
      await db
        .update(businesses)
        .set({ isActive: false })
        .where(eq(businesses.id, businessId));
      await http().get(ME).auth(staff, { type: 'bearer' }).expect(401);
      await http().get(ME).auth(shop, { type: 'bearer' }).expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the staff profile without the password hash', async () => {
      const token = await login(loginOf('owner'));
      const res = await http()
        .get(ME)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expectNoSecrets(res);
      expect(Object.keys(res.body).sort()).toEqual(
        [
          'business',
          'email',
          'fullName',
          'id',
          'lastLoginAt',
          'phone',
          'role',
          'type',
        ].sort(),
      );
      expect(res.body).toMatchObject({ type: 'staff', role: 'owner' });
    });

    it('returns the shop profile without the password hash', async () => {
      const token = await login(loginOf('shop'));
      const res = await http()
        .get(ME)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expectNoSecrets(res);
      expect(res.body).toMatchObject({
        type: 'shop',
        name: 'Kalimati Kirana Pasal',
        business: { id: businessId },
      });
    });

    it('requires a token', async () => {
      const res = await http().get(ME).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a garbage token and one signed with another secret', async () => {
      await http().get(ME).auth('garbage', { type: 'bearer' }).expect(401);
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.role, 'owner'));
      const forged = await new JwtService({
        secret: 'some-other-secret-that-is-long-enough-x',
      }).signAsync({
        type: 'staff',
        sub: owner.id,
        role: 'owner',
        businessId,
      });
      await http().get(ME).auth(forged, { type: 'bearer' }).expect(401);
    });
  });

  describe('user type and role guards', () => {
    it('rejects a shop token on a staff route', async () => {
      const token = await login(loginOf('shop'));
      await http()
        .get('/api/v1/probe/staff')
        .auth(token, { type: 'bearer' })
        .expect(403);
    });

    it('rejects a staff token on a shop route', async () => {
      const token = await login(loginOf('salesman'));
      await http()
        .get('/api/v1/probe/shop')
        .auth(token, { type: 'bearer' })
        .expect(403);
    });

    it('lets each token type through its own route', async () => {
      const staff = await login(loginOf('salesman'));
      const shop = await login(loginOf('shop'));
      const s = await http()
        .get('/api/v1/probe/staff')
        .auth(staff, { type: 'bearer' })
        .expect(200);
      expect(s.body).toMatchObject({ type: 'staff', role: 'salesman' });
      const c = await http()
        .get('/api/v1/probe/shop')
        .auth(shop, { type: 'bearer' })
        .expect(200);
      expect(c.body).toMatchObject({ type: 'shop' });
    });

    it('@Roles admits only the listed staff roles, never a shop', async () => {
      const owner = await login(loginOf('owner'));
      const salesman = await login(loginOf('salesman'));
      const shop = await login(loginOf('shop'));
      const probe = (t: string) =>
        http().get('/api/v1/probe/owner').auth(t, { type: 'bearer' });
      await probe(owner).expect(200);
      await probe(salesman).expect(403);
      await probe(shop).expect(403);
    });

    it('uses the current role from the database, not the one in the token', async () => {
      const token = await login(loginOf('manager'));
      // Demote the manager after their token was issued.
      await db
        .update(users)
        .set({ role: 'salesman' })
        .where(eq(users.email, loginOf('manager').email));
      const res = await http()
        .get('/api/v1/probe/staff')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body.role).toBe('salesman');
    });
  });

  describe('POST /auth/change-password', () => {
    it.each(['salesman', 'shop'])(
      'changes the password for a %s',
      async (role) => {
        const l = loginOf(role);
        const token = await login(l);
        const res = await http()
          .post(CHANGE_PASSWORD)
          .auth(token, { type: 'bearer' })
          .send({ currentPassword: l.password, newPassword: 'Brand-new-pw1' })
          .expect(204);
        expectNoSecrets(res);

        const route = l.type === 'staff' ? STAFF_LOGIN : SHOP_LOGIN;
        await http()
          .post(route)
          .send({ email: l.email, password: l.password })
          .expect(401);
        await http()
          .post(route)
          .send({ email: l.email, password: 'Brand-new-pw1' })
          .expect(200);
      },
    );

    it('rejects a wrong current password and keeps the old one', async () => {
      const l = loginOf('owner');
      const token = await login(l);
      const res = await http()
        .post(CHANGE_PASSWORD)
        .auth(token, { type: 'bearer' })
        .send({ currentPassword: 'not-it', newPassword: 'Brand-new-pw1' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      await login(l);
    });

    it('rejects a new password shorter than 8 characters', async () => {
      const l = loginOf('owner');
      const token = await login(l);
      await http()
        .post(CHANGE_PASSWORD)
        .auth(token, { type: 'bearer' })
        .send({ currentPassword: l.password, newPassword: 'short' })
        .expect(400);
    });

    it('requires a token', async () => {
      await http()
        .post(CHANGE_PASSWORD)
        .send({ currentPassword: 'a', newPassword: 'Brand-new-pw1' })
        .expect(401);
    });
  });

  describe('rate limiting', () => {
    it.each([
      ['staff', STAFF_LOGIN],
      ['shop', SHOP_LOGIN],
    ])('limits %s login attempts per client', async (_type, route) => {
      for (let i = 0; i < LOGIN_THROTTLE.limit; i++) {
        await http()
          .post(route)
          .send({ email: 'x@asva.test', password: 'wrong' })
          .expect(401);
      }
      const res = await http()
        .post(route)
        .send({ email: 'x@asva.test', password: 'wrong' })
        .expect(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('blocks even correct credentials once the limit is hit', async () => {
      const l = loginOf('owner');
      for (let i = 0; i < LOGIN_THROTTLE.limit; i++) {
        await http()
          .post(STAFF_LOGIN)
          .send({ email: l.email, password: 'wrong' });
      }
      await http()
        .post(STAFF_LOGIN)
        .send({ email: l.email, password: l.password })
        .expect(429);
    });

    it('does not rate limit authenticated routes', async () => {
      const token = await login(loginOf('owner'));
      for (let i = 0; i < LOGIN_THROTTLE.limit + 2; i++) {
        await http().get(ME).auth(token, { type: 'bearer' }).expect(200);
      }
    });
  });
});
