import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { UPLOAD_THROTTLE } from '../src/common/throttle.js';
import { validateEnv } from '../src/config/env.validation.js';
import { Database, DRIZZLE } from '../src/database/database.types.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import { StorageService } from '../src/storage/storage.service.js';
import { staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { TEST_CORS_ORIGIN } from './setup-env.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

describe('Hardening (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  describe('security headers', () => {
    it('sets helmet’s headers', async () => {
      const res = await http().get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows only the origins in CORS_ORIGINS', async () => {
      const ok = await http()
        .get('/api/v1/health')
        .set('Origin', TEST_CORS_ORIGIN);
      expect(ok.headers['access-control-allow-origin']).toBe(TEST_CORS_ORIGIN);

      const other = await http()
        .get('/api/v1/health')
        .set('Origin', 'https://evil.example');
      expect(other.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight for an allowed origin only', async () => {
      const ok = await http()
        .options('/api/v1/sales')
        .set('Origin', TEST_CORS_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,idempotency-key')
        .expect(204);
      expect(ok.headers['access-control-allow-origin']).toBe(TEST_CORS_ORIGIN);
      expect(ok.headers['access-control-allow-headers']).toMatch(
        /idempotency-key/i,
      );

      const other = await http()
        .options('/api/v1/sales')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(other.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('parses the env list, and refuses anything that is not an origin', () => {
      const base = {
        DATABASE_URL: 'postgresql://u:p@localhost/app',
        JWT_SECRET: 'x'.repeat(32),
      };
      expect(validateEnv(base).CORS_ORIGINS).toEqual([]);
      expect(
        validateEnv({
          ...base,
          CORS_ORIGINS: ' https://a.example , http://localhost:5173,',
        }).CORS_ORIGINS,
      ).toEqual(['https://a.example', 'http://localhost:5173']);
      for (const bad of ['*', 'a.example', 'https://a.example/', 'ftp://a']) {
        expect(() => validateEnv({ ...base, CORS_ORIGINS: bad })).toThrow(
          /CORS_ORIGINS/,
        );
      }
    });
  });

  describe('body size limit', () => {
    it('rejects a JSON body over 256 KB in the standard error shape', async () => {
      const res = await http()
        .post('/api/v1/auth/staff/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(300_000) }))
        .expect(413);
      expect(res.body).toEqual({
        error: expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }),
      });
    });

    it('rejects malformed JSON as a 400, not a 500', async () => {
      const res = await http()
        .post('/api/v1/auth/staff/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ')
        .expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects an oversized multipart text field', async () => {
      await truncateAll(db);
      const business = await insertBusiness(db);
      const salesman = await insertUser(db, business.id);
      const res = await http()
        .post('/api/v1/expenses')
        .auth(await staffToken(app, salesman), { type: 'bearer' })
        .field('type', 'fuel')
        .field('amountPaisa', '100')
        .field('description', 'x'.repeat(20_000))
        .attach('receipt', Buffer.from('not reached'), 'r.jpg');
      expect([400, 413]).toContain(res.status);
      expect(res.body.error.code).toBeDefined();
    });
  });

  describe('upload throttling', () => {
    it('limits each staff member per upload route, not each other', async () => {
      await truncateAll(db);
      const business = await insertBusiness(db);
      const [a, b] = [
        await staffToken(app, await insertUser(db, business.id)),
        await staffToken(app, await insertUser(db, business.id)),
      ];
      const expense = (token: string) =>
        http()
          .post('/api/v1/expenses')
          .auth(token, { type: 'bearer' })
          .send({ type: 'khaja', amountPaisa: 100 });

      for (let i = 0; i < UPLOAD_THROTTLE.limit; i++) {
        await expense(a).expect(201);
      }
      const blocked = await expense(a).expect(429);
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
      await expense(b).expect(201); // a colleague on the same IP is unaffected

      // Reads and the login budget are separate.
      await http()
        .get('/api/v1/expenses')
        .auth(a, { type: 'bearer' })
        .expect(200);
      await http()
        .post('/api/v1/auth/staff/login')
        .send({ email: 'nobody@asva.test', password: 'wrong-password' })
        .expect(401);
    });
  });

  describe('OpenAPI docs', () => {
    it('are served at /docs outside production', async () => {
      const html = await http().get('/docs').expect(200);
      expect(html.text).toMatch(/swagger/i);
      const json = await http().get('/docs-json').expect(200);
      expect(json.body.openapi).toMatch(/^3\./);
      expect(json.body.paths['/api/v1/sales']).toBeDefined();
      expect(json.body.components.securitySchemes.bearer).toBeDefined();
      await http().get('/api/v1/docs').expect(404);
    });

    it('are not served in production', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(StorageService)
        .useValue(new MemoryStorage())
        .compile();
      const prod = moduleRef.createNestApplication({ bufferLogs: true });
      // Only configureApp sees production; the database was already wired
      // to the test database when the module compiled.
      const config = prod.get(ConfigService);
      const real = config.get.bind(config);
      const spy = jest
        .spyOn(config, 'get')
        .mockImplementation((key: string, ...rest: unknown[]) =>
          key === 'NODE_ENV'
            ? 'production'
            : (real as (k: string, ...r: unknown[]) => unknown)(key, ...rest),
        );
      configureApp(prod);
      spy.mockRestore();
      await prod.init();
      try {
        expect(prod.get<Database>(DRIZZLE)).toBeDefined();
        await request(prod.getHttpServer()).get('/docs').expect(404);
        await request(prod.getHttpServer()).get('/docs-json').expect(404);
        await request(prod.getHttpServer()).get('/api/v1/health').expect(200);
      } finally {
        await prod.close();
      }
    });
  });
});
