/**
 * Manual check of the Cloudinary credentials in .env. Not part of the test
 * suite, and it talks to the real Cloudinary account.
 *
 *   npm run storage:verify-cloudinary
 *
 * Uploads a small stamped test image, reads it back through the driver and
 * compares the bytes, confirms it is not publicly reachable, then deletes it.
 * Works whatever STORAGE_DRIVER is set to; needs the three CLOUDINARY_* vars.
 */
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { validateEnv } from '../src/config/env.validation.js';
import { CloudinaryStorage } from '../src/storage/drivers/cloudinary.storage.js';
import { ImageService } from '../src/storage/image.service.js';
import { newStorageKey } from '../src/storage/storage-key.js';

// Not a real business: makes the test asset easy to spot in the console.
const VERIFY_BUSINESS_ID = '00000000-0000-4000-8000-000000000000';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function step(label: string, ok: boolean, detail = ''): void {
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`,
  );
  if (!ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  process.loadEnvFile?.('.env');
  const env = validateEnv(process.env);
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error(
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env first.',
    );
    process.exit(1);
  }
  // Only the cloud name and key are printed; never the secret.
  console.log(
    `Cloud: ${CLOUDINARY_CLOUD_NAME}, key: ...${CLOUDINARY_API_KEY.slice(-4)}\n`,
  );

  const storage = new CloudinaryStorage({
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
  });
  const original = await sharp({
    create: { width: 640, height: 400, channels: 3, background: '#2f6f9f' },
  })
    .jpeg()
    .toBuffer();
  const stamped = await new ImageService().stampDate(original, new Date());
  const key = newStorageKey(VERIFY_BUSINESS_ID, 'logos');
  console.log(`Key: ${key}`);

  let uploaded = false;
  try {
    await storage.put(key, stamped, 'image/jpeg');
    uploaded = true;
    step('upload as type "authenticated"', true);

    const { stream, mime } = await storage.get(key);
    const back = await readAll(stream);
    step(
      'read back through a signed URL',
      true,
      `${back.length} bytes, ${mime}`,
    );
    step('bytes match what was uploaded', sha256(back) === sha256(stamped));

    // Without a signature the asset must not be reachable at all.
    for (const [label, type] of [
      ['unsigned authenticated URL is refused', 'authenticated'],
      ['public upload URL does not exist', 'upload'],
    ] as const) {
      const res = await fetch(
        cloudinary.url(key, { resource_type: 'image', type, secure: true }),
      );
      step(label, !res.ok, `HTTP ${res.status}`);
    }
  } finally {
    if (uploaded) {
      await storage.delete(key);
      step('delete', true);
    }
  }
  console.log(
    process.exitCode ? '\nSome checks failed.' : '\nAll checks passed.',
  );
}

main().catch((err: unknown) => {
  console.error(`FAIL ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
