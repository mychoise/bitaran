import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { newStorageKey } from '../storage-key.js';
import { StorageNotFoundError, StorageService } from '../storage.service.js';
import { CloudinaryStorage } from './cloudinary.storage.js';
import { LocalStorage } from './local.storage.js';
import { MemoryStorage } from './memory.storage.js';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

describe.each([
  [
    'MemoryStorage',
    async () => ({ storage: new MemoryStorage(), cleanup: async () => {} }),
  ],
  [
    'LocalStorage',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'asva-storage-'));
      return {
        storage: new LocalStorage(dir) as StorageService,
        cleanup: () => rm(dir, { recursive: true, force: true }),
      };
    },
  ],
])('%s', (_name, make) => {
  let storage: StorageService;
  let cleanup: () => Promise<void>;
  let png: Buffer;
  const key = newStorageKey(randomUUID(), 'payment-images');

  beforeEach(async () => {
    ({ storage, cleanup } = await make());
    png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
  });
  afterEach(() => cleanup());

  it('puts, gets and deletes', async () => {
    await storage.put(key, png, 'image/png');
    const { stream, mime } = await storage.get(key);
    expect(mime).toBe('image/png');
    expect((await readAll(stream)).equals(png)).toBe(true);

    await storage.delete(key);
    await expect(storage.get(key)).rejects.toBeInstanceOf(StorageNotFoundError);
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('reports a missing key as not found', async () => {
    await expect(
      storage.get(newStorageKey(randomUUID(), 'logos')),
    ).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it.each(['../../etc/passwd', 'a/b/c', `${randomUUID()}/logos/x.png`])(
    'refuses key %p',
    async (bad) => {
      await expect(storage.put(bad, png, 'image/png')).rejects.toThrow(
        /Invalid storage key/,
      );
      await expect(storage.get(bad)).rejects.toThrow(/Invalid storage key/);
      await expect(storage.delete(bad)).rejects.toThrow(/Invalid storage key/);
    },
  );
});

describe('LocalStorage', () => {
  it('lays files out by key and never overwrites one', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'asva-storage-'));
    try {
      const storage = new LocalStorage(dir);
      const businessId = randomUUID();
      const key = newStorageKey(businessId, 'logos');
      await storage.put(key, Buffer.from([0xff, 0xd8, 0xff, 1]), 'image/jpeg');
      expect(await readdir(join(dir, businessId, 'logos'))).toEqual([
        key.split('/')[2],
      ]);
      await expect(
        storage.put(key, Buffer.from([0xff, 0xd8, 0xff, 2]), 'image/jpeg'),
      ).rejects.toThrow(/EEXIST/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('CloudinaryStorage', () => {
  it('refuses to be constructed under test', () => {
    expect(
      () =>
        new CloudinaryStorage({ cloudName: 'c', apiKey: 'k', apiSecret: 's' }),
    ).toThrow(/memory/);
  });
});
