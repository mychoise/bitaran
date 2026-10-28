/** Postgres error codes the app reacts to. */
export const PG = {
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  FOREIGN_KEY_VIOLATION: '23503',
  NUMERIC_OUT_OF_RANGE: '22003',
} as const;

export interface PgErrorFields {
  code?: string;
  constraint?: string;
}

/** Drizzle wraps driver errors; walk `cause` to find the pg error fields. */
export function pgErrorOf(err: unknown): PgErrorFields {
  let current: unknown = err;
  while (current && typeof current === 'object') {
    const c = current as PgErrorFields & { cause?: unknown };
    if (typeof c.code === 'string' && /^[0-9A-Z]{5}$/.test(c.code)) return c;
    current = c.cause;
  }
  return {};
}

/** True if `err` is a unique violation of the named constraint. */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const pg = pgErrorOf(err);
  return pg.code === PG.UNIQUE_VIOLATION && pg.constraint === constraint;
}
