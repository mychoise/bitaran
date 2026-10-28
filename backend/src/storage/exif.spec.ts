import sharp from 'sharp';
import { exifTakenAt } from './exif.js';

const base = () =>
  sharp({ create: { width: 20, height: 20, channels: 3, background: '#777' } });

describe('exifTakenAt', () => {
  it('reads DateTimeOriginal as Nepal time when no offset is given', async () => {
    const img = await base()
      .jpeg()
      .withExif({ IFD2: { DateTimeOriginal: '2026:10:28 10:30:45' } })
      .toBuffer();
    expect((await exifTakenAt(img))?.toISOString()).toBe(
      '2026-10-28T04:45:45.000Z',
    );
  });

  it('honours OffsetTimeOriginal', async () => {
    const img = await base()
      .jpeg()
      .withExif({
        IFD2: {
          DateTimeOriginal: '2026:10:28 10:30:45',
          OffsetTimeOriginal: '+01:00',
        },
      })
      .toBuffer();
    expect((await exifTakenAt(img))?.toISOString()).toBe(
      '2026-10-28T09:30:45.000Z',
    );
  });

  it.each([
    ['a PNG with no EXIF', () => base().png().toBuffer()],
    ['a JPEG with no EXIF', () => base().jpeg().toBuffer()],
    [
      'a JPEG with EXIF but no capture time',
      () =>
        base()
          .jpeg()
          .withExif({ IFD0: { Make: 'Cam' } })
          .toBuffer(),
    ],
    [
      'a garbled capture time',
      () =>
        base()
          .jpeg()
          .withExif({ IFD2: { DateTimeOriginal: 'yesterday-ish' } })
          .toBuffer(),
    ],
    [
      'a WebP (exifr cannot read it)',
      () =>
        base()
          .webp()
          .withExif({ IFD2: { DateTimeOriginal: '2026:10:28 10:30:45' } })
          .toBuffer(),
    ],
  ])('returns null for %s', async (_label, make) => {
    expect(await exifTakenAt(await make())).toBeNull();
  });
});
