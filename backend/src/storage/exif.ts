import exifr from 'exifr';

/** Phones write local time; ours are in Nepal unless the photo says otherwise. */
const DEFAULT_OFFSET = '+05:45';
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const OFFSET = /^[+-]\d{2}:\d{2}$/;

/**
 * When the camera says the photo was taken, from EXIF DateTimeOriginal (or
 * CreateDate), or null if there is none or it cannot be read. EXIF times
 * carry no zone: OffsetTimeOriginal is used when present, else Nepal time.
 * Read this before stamping; stamping removes EXIF.
 */
export async function exifTakenAt(buffer: Buffer): Promise<Date | null> {
  let tags: Record<string, unknown> | undefined;
  try {
    // Raw strings: exifr would otherwise read the time in the server's zone.
    tags = (await exifr.parse(buffer, {
      pick: [
        'DateTimeOriginal',
        'OffsetTimeOriginal',
        'CreateDate',
        'OffsetTimeDigitized',
      ],
      reviveValues: false,
    })) as Record<string, unknown> | undefined;
  } catch {
    return null; // unreadable or unsupported (exifr does not read WebP)
  }
  if (!tags) return null;

  const [raw, rawOffset] =
    typeof tags.DateTimeOriginal === 'string'
      ? [tags.DateTimeOriginal, tags.OffsetTimeOriginal]
      : [tags.CreateDate, tags.OffsetTimeDigitized];
  const m = typeof raw === 'string' ? EXIF_DATE.exec(raw.trim()) : null;
  if (!m) return null;
  const offset =
    typeof rawOffset === 'string' && OFFSET.test(rawOffset.trim())
      ? rawOffset.trim()
      : DEFAULT_OFFSET;
  const at = new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`,
  );
  return Number.isNaN(at.getTime()) ? null : at;
}
