import { NestFactory } from '@nestjs/core';
import { is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { LocalStorage } from '../../storage/drivers/local.storage.js';
import { DatabaseCliModule } from '../cli.module.js';
import { DRIZZLE, Database } from '../database.types.js';
import * as schema from '../schema/index.js';
import { seedActivity } from './demo-activity.js';
import { seed } from './seed.js';

// npm run seed               one demo business (refuses unless the database is empty)
// npm run seed -- --demo     ...plus a week of demo activity (day plans, sales, payments, photos)
// npm run seed -- --reset    empties every table first. Development only: refused in production.

const args = new Set(process.argv.slice(2));

async function reset(db: Database): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset: NODE_ENV is production.');
  }
  const tables = (Object.values(schema) as unknown[])
    .filter((v): v is PgTable => is(v, PgTable))
    .map((t) => `"${getTableConfig(t).name}"`);
  await db.execute(
    sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`),
  );
  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  console.log(`Emptied every table in "${rows[0]?.name}".`);
}

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(DatabaseCliModule, {
    logger: ['error'],
  });
  try {
    const db = ctx.get<Database>(DRIZZLE);
    if (args.has('--reset')) await reset(db);
    const result = await seed(db);
    console.log(`Seeded business ${result.businessId}\n`);
    let logins = result.logins;

    if (args.has('--demo')) {
      // Demo pictures are written where the local storage driver reads them.
      const driver = process.env.STORAGE_DRIVER ?? 'local';
      const local =
        driver === 'local'
          ? new LocalStorage(process.env.LOCAL_STORAGE_PATH ?? './uploads')
          : null;
      if (!local) {
        console.log(
          `STORAGE_DRIVER is ${driver}: demo records with images (photos, cheques) are left out.`,
        );
      }
      const activity = await seedActivity(db, result, {
        storeImage: local
          ? (key, jpeg) => local.put(key, jpeg, 'image/jpeg')
          : undefined,
      });
      logins = [...logins, ...activity.logins];
      console.log('Demo activity:');
      console.table(activity.counts);
    }

    console.table(
      logins.map(({ type, role, name, email, password }) => ({
        type,
        role,
        name,
        email,
        password,
      })),
    );
  } finally {
    await ctx.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
