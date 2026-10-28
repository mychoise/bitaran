import { Database, Transaction } from '../../database/database.types.js';

export type { Database, Transaction };

/**
 * Runs `fn` inside one database transaction. Any change that touches more
 * than one table must go through this helper.
 *
 * Pass the root client to open a transaction, or an existing transaction to
 * join it (Drizzle nests it as a savepoint), so services can be composed.
 */
export async function withTransaction<T>(
  executor: Database | Transaction,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return executor.transaction(fn);
}
