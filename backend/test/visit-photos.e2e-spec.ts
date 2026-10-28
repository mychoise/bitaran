import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { nepalNow, nepalToday } from '../src/common/utils/date.util.js';
import { distanceInMetres } from '../src/common/utils/geo.util.js';
import { Database } from '../src/database/database.types.js';
import {
  dayPlans,
  retailClients,
  users,
  visitPhotos,
  visits,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { VisitPhotosService } from '../src/day-plans/visit-photos.service.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import { StorageService } from '../src/storage/storage.service.js';
import { staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type User = typeof users.$inferSelect;
type Visit = typeof visits.$inferSelect;

const PLANS = '/api/v1/day-plans';
const VISITS = '/api/v1/visits';

/** EXIF DateTimeOriginal as a phone in Nepal writes it: local, no zone. */
const exifTime = (d: Date) => {
  const [date, time] = nepalNow(d).split(' ');
  return `${date.replace(/-/g, ':')} ${time}`;
};

/** A unique photo (random pixels), optionally with an EXIF capture time. */
async function photo(
  takenAt?: Date,
  format: 'jpeg' | 'png' = 'jpeg',
): Promise<Buffer> {
  let img = sharp(randomBytes(48 * 32 * 3), {
    raw: { width: 48, height: 32, channels: 3 },
  }).toFormat(format);
  if (takenAt) {
    img = img.withExif({ IFD2: { DateTimeOriginal: exifTime(takenAt) } });
  }
  return img.toBuffer();
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

describe('Visit photos (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: MemoryStorage;
  let seeded: SeedResult;
  let staff: Record<'manager' | 'salesman1' | 'salesman2', User>;
  let stops: (Visit & { shopLat: number | null; shopLng: number | null })[];
  let planId: string;
  const tokens = {} as Record<
    'manager' | 'salesman1' | 'salesman2' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
  });
  const upload = (
    token: string,
    visitId: string,
    image: Buffer,
    fields: Record<string, string | number> = {},
    filename = 'photo.jpg',
  ) => {
    let req = http()
      .post(`${VISITS}/${visitId}/photos`)
      .auth(token, { type: 'bearer' });
    for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v));
    return req.attach('photo', image, { filename });
  };
  /** The shop's own location, i.e. where an honest photo is taken. */
  const atShop = (i: number) => ({
    lat: stops[i].shopLat!,
    lng: stops[i].shopLng!,
  });

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
      manager: byEmail('manager@asva.test'),
      salesman1: byEmail('salesman1@asva.test'),
      salesman2: byEmail('salesman2@asva.test'),
    };
    for (const k of Object.keys(staff) as (keyof typeof staff)[]) {
      tokens[k] = await staffToken(app, staff[k]);
    }
    const b = await insertBusiness(db);
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, b.id, { role: 'owner' }),
    );

    planId = (
      await as(tokens.manager)
        .post(PLANS, {
          salesmanId: staff.salesman1.id,
          routeId: seeded.routeId,
          planDate: nepalToday(),
          stock: [],
        })
        .expect(201)
    ).body.id;
    await as(tokens.salesman1).post(`${PLANS}/${planId}/start`, {}).expect(200);
    stops = (
      await db
        .select({
          v: visits,
          shopLat: retailClients.lat,
          shopLng: retailClients.lng,
        })
        .from(visits)
        .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
        .where(eq(visits.dayPlanId, planId))
        .orderBy(asc(visits.sequence))
    ).map((r) => ({ ...r.v, shopLat: r.shopLat, shopLng: r.shopLng }));
  });
  afterAll(() => app.close());

  describe('uploading', () => {
    it('accepts a fresh photo at the shop with no flags, stores only the stamped image', async () => {
      const original = await photo(minutesAgo(2));
      const before = Date.now();
      const res = await upload(tokens.salesman1, stops[0].id, original, {
        ...atShop(0),
        note: 'Shelf restocked',
      }).expect(201);
      expect(res.body).toMatchObject({
        visitId: stops[0].id,
        distanceFromShopM: 0,
        flagReason: null,
        note: 'Shelf restocked',
        lat: stops[0].shopLat,
        lng: stops[0].shopLng,
      });
      const takenAt = new Date(res.body.takenAt).getTime();
      expect(takenAt).toBeGreaterThanOrEqual(before - 1000);
      expect(takenAt).toBeLessThanOrEqual(Date.now() + 1000);
      expect(
        Math.abs(
          new Date(res.body.exifTakenAt).getTime() - minutesAgo(2).getTime(),
        ),
      ).toBeLessThan(5000);

      // One file, the stamped one: the original bytes are not kept.
      expect(storage.files.size).toBe(1);
      const stored = storage.files.get(res.body.imageKey)!;
      expect(res.body.imageKey).toMatch(
        new RegExp(`^${seeded.businessId}/visit-photos/[0-9a-f-]{36}$`),
      );
      expect(stored.buffer.equals(original)).toBe(false);
      expect((await sharp(stored.buffer).metadata()).exif).toBeUndefined();
    });

    it('a duplicate photo returns 409 and stores nothing', async () => {
      const img = await photo(minutesAgo(1));
      await upload(tokens.salesman1, stops[0].id, img).expect(201);
      for (const visit of [stops[0], stops[1]]) {
        const res = await upload(
          tokens.salesman1,
          visit.id,
          Buffer.from(img),
        ).expect(409);
        expect(res.body.error.code).toBe('DUPLICATE_PHOTO');
      }
      expect(storage.files.size).toBe(1);
      expect(await db.select().from(visitPhotos)).toHaveLength(1);
    });

    it('two uploads of one photo at once: one wins, the other leaves no file', async () => {
      const img = await photo(minutesAgo(1));
      const results = await Promise.all([
        upload(tokens.salesman1, stops[0].id, Buffer.from(img)),
        upload(tokens.salesman1, stops[1].id, Buffer.from(img)),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(storage.files.size).toBe(1);
    });

    it('a photo without EXIF is accepted and flagged no_exif', async () => {
      const res = await upload(
        tokens.salesman1,
        stops[0].id,
        await photo(undefined, 'png'),
        atShop(0),
        'screenshot.png',
      ).expect(201);
      expect(res.body).toMatchObject({
        exifTakenAt: null,
        flagReason: 'no_exif',
        distanceFromShopM: 0,
      });
    });

    it('a far photo is accepted and flagged too_far', async () => {
      // About 1.5 km north of the shop.
      const far = { lat: stops[0].shopLat! + 0.0135, lng: stops[0].shopLng! };
      const res = await upload(
        tokens.salesman1,
        stops[0].id,
        await photo(minutesAgo(1)),
        far,
      ).expect(201);
      expect(res.body.flagReason).toBe('too_far');
      expect(res.body.distanceFromShopM).toBe(
        Math.round(distanceInMetres(far, atShop(0))),
      );
      expect(res.body.distanceFromShopM).toBeGreaterThan(1400);
    });

    it('flags an old (or future) EXIF time as exif_old, and joins several reasons', async () => {
      const old = await upload(
        tokens.salesman1,
        stops[0].id,
        await photo(minutesAgo(120)),
        atShop(0),
      ).expect(201);
      expect(old.body.flagReason).toBe('exif_old');

      const future = await upload(
        tokens.salesman1,
        stops[1].id,
        await photo(minutesAgo(-30)),
      ).expect(201);
      expect(future.body.flagReason).toBe('exif_old');

      const both = await upload(
        tokens.salesman1,
        stops[2].id,
        await photo(undefined, 'png'),
        { lat: 27.8, lng: 85.4 },
        'x.png',
      ).expect(201);
      expect(both.body.flagReason).toBe('no_exif,too_far');
    });

    it('leaves the distance empty, and does not flag it, if a location is missing', async () => {
      const noPhotoLocation = await upload(
        tokens.salesman1,
        stops[0].id,
        await photo(minutesAgo(1)),
      ).expect(201);
      expect(noPhotoLocation.body).toMatchObject({
        distanceFromShopM: null,
        flagReason: null,
      });

      await db
        .update(retailClients)
        .set({ lat: null, lng: null })
        .where(eq(retailClients.id, stops[1].clientId));
      const noShopLocation = await upload(
        tokens.salesman1,
        stops[1].id,
        await photo(minutesAgo(1)),
        { lat: 28.5, lng: 84.0 },
      ).expect(201);
      expect(noShopLocation.body).toMatchObject({
        distanceFromShopM: null,
        flagReason: null,
      });
    });

    it('taken_at always comes from the server', async () => {
      // The camera says 2020; the client also tries to send its own time.
      const img = await photo(new Date('2020-01-01T06:00:00Z'));
      const sneaky = await upload(tokens.salesman1, stops[0].id, img, {
        takenAt: '2020-01-01T06:00:00Z',
      }).expect(400);
      expect(sneaky.body.error.code).toBe('VALIDATION_FAILED');

      const before = Date.now();
      const res = await upload(tokens.salesman1, stops[0].id, img).expect(201);
      const takenAt = new Date(res.body.takenAt).getTime();
      expect(takenAt).toBeGreaterThanOrEqual(before - 1000);
      expect(takenAt).toBeLessThanOrEqual(Date.now() + 1000);
      expect(res.body.exifTakenAt).toBe('2020-01-01T06:00:00.000Z');
      expect(res.body.flagReason).toBe('exif_old');
    });

    it('a salesman cannot upload to another salesman’s visit', async () => {
      const res = await upload(
        tokens.salesman2,
        stops[0].id,
        await photo(minutesAgo(1)),
      ).expect(404);
      expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
      await upload(tokens.manager, stops[0].id, await photo()).expect(403);
      expect(storage.files.size).toBe(0);
      expect(await db.select().from(visitPhotos)).toHaveLength(0);
    });

    it('needs the plan to be in progress', async () => {
      await db
        .update(dayPlans)
        .set({ status: 'closed' })
        .where(eq(dayPlans.id, planId));
      const res = await upload(
        tokens.salesman1,
        stops[0].id,
        await photo(minutesAgo(1)),
      ).expect(409);
      expect(res.body.error.code).toBe('DAY_PLAN_NOT_IN_PROGRESS');
      expect(storage.files.size).toBe(0);
    });

    it.each([
      [
        'a non-image',
        () => Buffer.from('not a photo'),
        {},
        415,
        'UNSUPPORTED_FILE_TYPE',
      ],
      [
        'half a location',
        () => photo(),
        { lat: 27.7 },
        400,
        'VALIDATION_FAILED',
      ],
      [
        'a non-numeric latitude',
        () => photo(),
        { lat: 'north', lng: 85.3 },
        400,
        'VALIDATION_FAILED',
      ],
    ])('rejects %s', async (_label, make, fields, status, code) => {
      const res = await upload(
        tokens.salesman1,
        stops[0].id,
        await make(),
        fields,
      );
      expect([res.status, res.body.error?.code]).toEqual([status, code]);
      expect(storage.files.size).toBe(0);
    });

    it('requires the file', async () => {
      const res = await http()
        .post(`${VISITS}/${stops[0].id}/photos`)
        .auth(tokens.salesman1, { type: 'bearer' })
        .field('note', 'forgot the photo')
        .expect(400);
      expect(res.body.error.code).toBe('FILE_REQUIRED');
    });
  });

  describe('flag thresholds', () => {
    it('flags only beyond 10 minutes and 150 metres by default', () => {
      const svc = app.get(VisitPhotosService);
      const now = new Date();
      const at = (ms: number) => new Date(now.getTime() - ms);
      expect(svc.flagsFor(now, at(10 * 60_000), 150)).toEqual([]);
      expect(svc.flagsFor(now, at(10 * 60_000 + 1000), 151)).toEqual([
        'exif_old',
        'too_far',
      ]);
      expect(svc.flagsFor(now, null, null)).toEqual(['no_exif']);
    });
  });

  describe('reading', () => {
    let flaggedId: string;
    let cleanId: string;
    beforeEach(async () => {
      cleanId = (
        await upload(
          tokens.salesman1,
          stops[0].id,
          await photo(minutesAgo(1)),
          atShop(0),
        ).expect(201)
      ).body.id;
      flaggedId = (
        await upload(
          tokens.salesman1,
          stops[1].id,
          await photo(undefined, 'png'),
          {},
          'x.png',
        ).expect(201)
      ).body.id;
    });

    it('GET /visits/:id/photos: the plan’s salesman and managers only', async () => {
      const own = await as(tokens.salesman1)
        .get(`${VISITS}/${stops[0].id}/photos`)
        .expect(200);
      expect(own.body.map((x: { id: string }) => x.id)).toEqual([cleanId]);
      await as(tokens.manager)
        .get(`${VISITS}/${stops[0].id}/photos`)
        .expect(200);
      await as(tokens.salesman2)
        .get(`${VISITS}/${stops[0].id}/photos`)
        .expect(404);
      await as(tokens.bOwner)
        .get(`${VISITS}/${stops[0].id}/photos`)
        .expect(404);
    });

    it('GET /visit-photos filters by flagged and date, for managers', async () => {
      const flagged = await as(tokens.manager)
        .get(`/api/v1/visit-photos?flagged=true&date=${nepalToday()}`)
        .expect(200);
      expect(flagged.body.data.map((x: { id: string }) => x.id)).toEqual([
        flaggedId,
      ]);
      expect(flagged.body.data[0]).toMatchObject({
        flagReason: 'no_exif',
        dayPlanId: planId,
        shop: { id: stops[1].clientId },
        salesman: { id: staff.salesman1.id },
      });

      const all = await as(tokens.manager).get('/api/v1/visit-photos');
      expect(all.body.total).toBe(2);
      const clean = await as(tokens.manager).get(
        '/api/v1/visit-photos?flagged=false',
      );
      expect(clean.body.data.map((x: { id: string }) => x.id)).toEqual([
        cleanId,
      ]);
      const otherDay = await as(tokens.manager).get(
        '/api/v1/visit-photos?date=2020-01-01',
      );
      expect(otherDay.body.total).toBe(0);

      await as(tokens.salesman1).get('/api/v1/visit-photos').expect(403);
      expect(
        (await as(tokens.bOwner).get('/api/v1/visit-photos')).body.total,
      ).toBe(0);
    });
  });
});
