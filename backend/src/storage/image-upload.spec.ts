import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MAX_IMAGE_BYTES, validateImage } from './image-upload.js';

const image = (format: 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff') =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: '#c33' } })
    .toFormat(format)
    .toBuffer();

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: {
      getStatus(): number;
      getResponse(): { error: { code: string } };
    }) => [e.getStatus(), e.getResponse().error.code],
  );

describe('validateImage', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ] as const)('accepts %s and reports %s', async (format, mime) => {
    const buffer = await image(format);
    const result = await validateImage(buffer);
    expect(result).toEqual({
      buffer,
      mime,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    });
  });

  it('gives the same sha256 for the same bytes, and a different one otherwise', async () => {
    const a = await image('png');
    const first = await validateImage(a);
    const again = await validateImage(Buffer.from(a));
    expect(again.sha256).toBe(first.sha256);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    const other = await validateImage(await image('jpeg'));
    expect(other.sha256).not.toBe(first.sha256);
  });

  it.each([
    ['plain text', async () => Buffer.from('hello, this is not an image')],
    ['a PDF', async () => Buffer.from('%PDF-1.7\n1 0 obj\n')],
    [
      'an HTML page',
      async () => Buffer.from('<html><script>alert(1)</script>'),
    ],
    ['a GIF', () => image('gif')],
    ['a TIFF', () => image('tiff')],
  ])('rejects %s as an unsupported type', async (_label, make) => {
    expect(await errorOf(validateImage(await make()))).toEqual([
      415,
      'UNSUPPORTED_FILE_TYPE',
    ]);
  });

  it('rejects a JPEG signature on bytes that are not a JPEG', async () => {
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('<?php system($_GET["c"]); ?>'),
    ]);
    expect(await errorOf(validateImage(fake))).toEqual([
      422,
      'IMAGE_UNREADABLE',
    ]);
  });

  it('rejects a file over 10 MB, even with a valid signature', async () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    (await image('jpeg')).copy(big);
    expect(await errorOf(validateImage(big))).toEqual([413, 'FILE_TOO_LARGE']);
  });

  it('rejects a missing or empty file', async () => {
    expect(await errorOf(validateImage(undefined))).toEqual([
      400,
      'FILE_REQUIRED',
    ]);
    expect(await errorOf(validateImage(Buffer.alloc(0)))).toEqual([
      400,
      'FILE_REQUIRED',
    ]);
  });
});
