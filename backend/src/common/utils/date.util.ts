/**
 * Returns the date in Asia/Kathmandu of `at` (default: now) as YYYY-MM-DD.
 * All business dates must use this helper — never derive from UTC now().
 */
export function nepalToday(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * Returns the Nepal date-time of `date` (default: now) as a human-readable
 * string for stamping on images (Gregorian), e.g. "2026-10-27 10:30:45".
 */
export function nepalNow(date: Date = new Date()): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  // Format as YYYY-MM-DD HH:MM:SS
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
