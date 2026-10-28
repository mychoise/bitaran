import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Injection tokens. Inject the client with `@Inject(DRIZZLE) db: Database`. */
export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');
