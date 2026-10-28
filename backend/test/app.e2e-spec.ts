import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.js';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(() => app.close());

  describe('GET /api/v1/health', () => {
    it('is public and reports the database as up', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });
  });

  describe('request id', () => {
    it('echoes a valid incoming X-Request-Id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('X-Request-Id', 'abc-123');
      expect(res.headers['x-request-id']).toBe('abc-123');
    });

    it('mints a new id when none (or a malformed one) is sent', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('X-Request-Id', 'bad id with spaces');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns unknown routes in the standard error format', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/nope')
      .expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), details: [] },
    });
  });

  it('does not serve routes outside /api/v1', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
