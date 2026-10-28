import {
  Controller,
  INestApplication,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../src/common/decorators/current-user.decorator.js';
import { StaffOnly } from '../src/common/decorators/user-type.decorator.js';
import { Database } from '../src/database/database.types.js';
import { retailClients, users } from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { MemoryStorage } from '../src/storage/drivers/memory.storage.js';
import {
  ImageUpload,
  MAX_IMAGE_BYTES,
  ParseImagePipe,
} from '../src/storage/image-upload.js';
import type { UploadedImage } from '../src/storage/image-upload.js';
import { ImageService } from '../src/storage/image.service.js';
import { newStorageKey } from '../src/storage/storage-key.js';
import { StorageService } from '../src/storage/storage.service.js';
import { shopToken, staffToken } from './utils/auth.js';
import { insertBusiness, insertUser } from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

const UPLOAD = '/api/v1/probe/upload';
const FILES = '/api/v1/files';

/** Shaped like the real upload endpoints to come: validate, stamp, store. */
@StaffOnly()
@Controller('probe')
class UploadProbeController {
  constructor(
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  @Post('upload')
  @ImageUpload('file')
  async upload(
    @CurrentUser() user: StaffTokenPayload,
    @UploadedFile(ParseImagePipe) image: UploadedImage,
  ) {
    const stamped = await this.images.stampDate(image.buffer, new Date());
    const key = newStorageKey(user.businessId, 'payment-images');
    await this.storage.put(key, stamped, image.mime);
    return { key, mime: image.mime, sha256: image.sha256 };
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describe('File storage (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: MemoryStorage;
  let seeded: SeedResult;
  let jpeg: Buffer;
  const tokens = {} as Record<
    'owner' | 'salesman' | 'shop' | 'otherOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const upload = (
    token: string,
    buffer: Buffer,
    filename = 'photo.jpg',
    contentType = 'image/jpeg',
  ) =>
    http()
      .post(UPLOAD)
      .auth(token, { type: 'bearer' })
      .attach('file', buffer, { filename, contentType });
  const fetchFile = (token: string, key: string) =>
    http()
      .get(`${FILES}/${key}`)
      .auth(token, { type: 'bearer' })
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  beforeAll(async () => {
    ({ app, db } = await createTestApp([UploadProbeController]));
    storage = app.get(StorageService);
    jpeg = await sharp({
      create: { width: 320, height: 240, channels: 3, background: '#468' },
    })
      .jpeg()
      .toBuffer();
  });
  beforeEach(async () => {
    await truncateAll(db);
    storage.files.clear();
    seeded = await seed(db);
    const staff = await db
      .select()
      .from(users)
      .where(eq(users.businessId, seeded.businessId));
    tokens.owner = await staffToken(
      app,
      staff.find((u) => u.role === 'owner')!,
    );
    tokens.salesman = await staffToken(
      app,
      staff.find((u) => u.role === 'salesman')!,
    );
    const [shop] = await db.select().from(retailClients).limit(1);
    tokens.shop = await shopToken(app, shop);
    const other = await insertBusiness(db);
    tokens.otherOwner = await staffToken(
      app,
      await insertUser(db, other.id, { role: 'owner' }),
    );
  });
  afterAll(() => app.close());

  it('uses the in-memory driver', () => {
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  describe('upload', () => {
    it('stores a stamped image under {businessId}/{category}/{uuid}', async () => {
      const res = await upload(tokens.salesman, jpeg).expect(201);
      expect(res.body.key).toMatch(
        new RegExp(`^${seeded.businessId}/payment-images/${UUID}$`),
      );
      expect(res.body).toMatchObject({
        mime: 'image/jpeg',
        sha256: createHash('sha256').update(jpeg).digest('hex'),
      });
      const stored = storage.files.get(res.body.key)!;
      expect(stored.mime).toBe('image/jpeg');
      // What is stored is the stamped image, not the upload.
      expect(stored.buffer.equals(jpeg)).toBe(false);
      const meta = await sharp(stored.buffer).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        'jpeg',
        320,
        240,
      ]);
    });

    it('gives the same sha256 for the same bytes', async () => {
      const a = await upload(tokens.owner, jpeg).expect(201);
      const b = await upload(tokens.owner, Buffer.from(jpeg)).expect(201);
      expect(a.body.sha256).toBe(b.body.sha256);
      expect(a.body.key).not.toBe(b.body.key);
    });

    it.each([
      ['a text file', Buffer.from('just some text'), 'notes.txt', 'text/plain'],
      [
        'a text file named and labelled as a JPEG',
        Buffer.from('definitely not a jpeg'),
        'photo.jpg',
        'image/jpeg',
      ],
      [
        'a PDF',
        Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n'),
        'cheque.pdf',
        'application/pdf',
      ],
      [
        'an SVG',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        'logo.png',
        'image/png',
      ],
    ])('rejects %s', async (_label, buffer, filename, contentType) => {
      const res = await upload(
        tokens.owner,
        buffer,
        filename,
        contentType,
      ).expect(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      expect(storage.files.size).toBe(0);
    });

    it('rejects a file over 10 MB', async () => {
      const big = Buffer.alloc(MAX_IMAGE_BYTES + 1024);
      jpeg.copy(big);
      const res = await upload(tokens.owner, big).expect(413);
      expect(res.body.error).toMatchObject({
        code: 'FILE_TOO_LARGE',
        message: 'Images must be 10 MB or smaller',
      });
      expect(storage.files.size).toBe(0);
    });

    it('requires a file', async () => {
      const res = await http()
        .post(UPLOAD)
        .auth(tokens.owner, { type: 'bearer' })
        .field('note', 'no file here')
        .expect(400);
      expect(res.body.error.code).toBe('FILE_REQUIRED');
    });
  });

  describe('GET /files/*key', () => {
    let key: string;
    let stored: Buffer;
    beforeEach(async () => {
      key = (await upload(tokens.salesman, jpeg).expect(201)).body.key;
      stored = storage.files.get(key)!.buffer;
    });

    it('streams the file to staff of its business, privately cached', async () => {
      for (const token of [tokens.owner, tokens.salesman]) {
        const res = await fetchFile(token, key).expect(200);
        expect(res.headers['content-type']).toBe('image/jpeg');
        expect(res.headers['cache-control']).toBe('private, max-age=300');
        expect((res.body as Buffer).equals(stored)).toBe(true);
        // Proxied, never redirected to a storage URL.
        expect(res.headers.location).toBeUndefined();
      }
    });

    it('returns 403 to staff of another business', async () => {
      const res = await fetchFile(tokens.otherOwner, key).expect(403);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(JSON.parse((res.body as Buffer).toString()).error.code).toBe(
        'FORBIDDEN',
      );
    });

    it('returns 403 to a shop token, even for its own business', async () => {
      await fetchFile(tokens.shop, key).expect(403);
    });

    it('requires a token', async () => {
      await http().get(`${FILES}/${key}`).expect(401);
    });

    it('returns 404 for a well-formed key with nothing stored', async () => {
      const missing = newStorageKey(seeded.businessId, 'logos');
      await fetchFile(tokens.owner, missing).expect(404);
    });

    it.each([
      () => 'not-a-key',
      () => `${seeded.businessId}/payment-images`,
      () => `${seeded.businessId}/secrets/${randomUUID()}`,
      () => `${seeded.businessId}/payment-images/${randomUUID()}.jpg`,
      () => `${seeded.businessId}/..%2F..%2Fetc/passwd`,
    ])('returns 404 for a malformed key (%#)', async (make) => {
      await fetchFile(tokens.owner, make()).expect(404);
    });

    it('never serves stored bytes as an executable type', async () => {
      const odd = newStorageKey(seeded.businessId, 'logos');
      await storage.put(
        odd,
        Buffer.from('<script>alert(1)</script>'),
        'text/html',
      );
      const res = await fetchFile(tokens.owner, odd).expect(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
