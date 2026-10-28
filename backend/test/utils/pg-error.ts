import { pgErrorOf } from '../../src/common/utils/pg-error.util.js';

export { PG, pgErrorOf } from '../../src/common/utils/pg-error.util.js';

export async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  constraint: string,
): Promise<void> {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (err === undefined) {
    throw new Error(
      `Expected ${constraint} (${code}) to reject, but the query succeeded`,
    );
  }
  expect(pgErrorOf(err)).toMatchObject({ code, constraint });
}
