import sharp from 'sharp';
import { ImageService } from './image.service.js';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3a7' } });

/** Share of pixels in a region whose colour moved noticeably. */
async function changedShare(
  before: Buffer,
  after: Buffer,
  region: { left: number; top: number; width: number; height: number },
) {
  const raw = (b: Buffer) =>
    sharp(b).removeAlpha().extract(region).raw().toBuffer();
  const [a, b] = await Promise.all([raw(before), raw(after)]);
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
    if (d > 30) changed++;
  }
  return changed / (a.length / 3);
}

describe('ImageService.stampDate', () => {
  const images = new ImageService();
  const when = new Date('2026-10-27T04:45:45Z'); // 10:30:45 in Nepal

  it.each(['jpeg', 'png', 'webp'] as const)(
    'stamps the bottom-right corner of a %s and keeps its format and size',
    async (format) => {
      const original = await solid(800, 600).toFormat(format).toBuffer();
      const stamped = await images.stampDate(original, when);

      const meta = await sharp(stamped).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        format,
        800,
        600,
      ]);

      const corner = { left: 600, top: 560, width: 200, height: 40 };
      const away = { left: 0, top: 0, width: 200, height: 40 };
      expect(await changedShare(original, stamped, corner)).toBeGreaterThan(
        0.9,
      );
      expect(await changedShare(original, stamped, away)).toBe(0);
      expect(meta.channels).toBe(3);
    },
  );

  it('turns the image upright first, so the stamp lands in the visible corner', async () => {
    // Stored 800x600 but tagged "rotate 90°": people see it as 600x800.
    const rotated = await solid(800, 600)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const stamped = await images.stampDate(rotated, when);
    const meta = await sharp(stamped).metadata();
    expect([meta.width, meta.height]).toEqual([600, 800]);
    expect(meta.orientation ?? 1).toBe(1);
  });

  it('copes with a very small image', async () => {
    const tiny = await solid(40, 12).png().toBuffer();
    const stamped = await images.stampDate(tiny, when);
    const meta = await sharp(stamped).metadata();
    expect([meta.width, meta.height]).toEqual([40, 12]);
  });

  it('drops EXIF metadata such as GPS', async () => {
    const withExif = await solid(200, 100)
      .jpeg()
      .withExif({ IFD0: { Make: 'TestCam' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const stamped = await images.stampDate(withExif, when);
    expect((await sharp(stamped).metadata()).exif).toBeUndefined();
  });
});
