import { NestFactory } from '@nestjs/core';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DatabaseCliModule } from './cli.module.js';
import { DRIZZLE, Database } from './database.types.js';

/** Applies pending migrations from ./drizzle to the configured database. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' });
}

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(DatabaseCliModule, {
    logger: ['error'],
  });
  try {
    await runMigrations(ctx.get<Database>(DRIZZLE));
    console.log('Migrations applied.');
  } finally {
    await ctx.close();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
