import { Test } from '@nestjs/testing';
import { is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { DatabaseCliModule } from '../../src/database/cli.module.js';
import { Database, DRIZZLE } from '../../src/database/database.types.js';
import * as schema from '../../src/database/schema/index.js';

const TABLES = (Object.values(schema) as unknown[])
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => `"${getTableConfig(t).name}"`);

/** Refuses to touch anything but a database whose name ends in `_test`. */
export async function assertTestDatabase(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  if (!rows[0]?.name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${rows[0]?.name}"`);
  }
}

/** Empties every table. Call in beforeEach for a clean state. */
export async function truncateAll(db: Database): Promise<void> {
  await assertTestDatabase(db);
  await db.execute(
    sql.raw(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`),
  );
}

export const TABLE_COUNT = TABLES.length;

/** Drizzle client on the test database, without the HTTP app. */
export async function createTestDb(): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseCliModule],
  }).compile();
  const db = moduleRef.get<Database>(DRIZZLE);
  await assertTestDatabase(db);
  return { db, close: () => moduleRef.close() };
}
