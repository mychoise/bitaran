// The one date helper. Business dates are Nepal (Asia/Kathmandu) calendar dates, kept as
// "YYYY-MM-DD" strings and shown in AD. Times are instants (ISO strings) shown in Nepal time.

export const NEPAL_TZ = "Asia/Kathmandu";

/** A Nepal calendar date, "YYYY-MM-DD". */
export type BusinessDate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const partsFmt = new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** The Nepal calendar date of an instant. */
export function nepalDateOf(instant: Date | string | number): BusinessDate {
  return partsFmt.format(new Date(instant));
}

/** Today's date in Nepal. */
export function todayNepal(now: Date = new Date()): BusinessDate {
  return nepalDateOf(now);
}

function assertDate(d: BusinessDate): void {
  if (!DATE_RE.test(d)) throw new Error(`Expected a date like 2026-10-14, got "${d}"`);
}

/** Calendar arithmetic on a business date (no time zone involved). */
export function addDays(d: BusinessDate, days: number): BusinessDate {
  assertDate(d);
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: BusinessDate, b: BusinessDate): number {
  assertDate(a);
  assertDate(b);
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-14" -> "14 Oct 2026". */
export function formatDate(d: BusinessDate): string {
  assertDate(d);
  return `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: NEPAL_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** An instant shown as Nepal time, "14:05". */
export function formatTime(instant: Date | string | number): string {
  return timeFmt.format(new Date(instant));
}

/** An instant shown as "14 Oct 2026, 14:05" in Nepal time. */
export function formatDateTime(instant: Date | string | number): string {
  return `${formatDate(nepalDateOf(instant))}, ${formatTime(instant)}`;
}

/** A Nepal date and a Nepal clock time ("09:30") as an ISO instant. Nepal is UTC+05:45 all year. */
export function nepalInstant(d: BusinessDate, hhmm: string): string {
  assertDate(d);
  return new Date(`${d}T${hhmm}:00+05:45`).toISOString();
}
