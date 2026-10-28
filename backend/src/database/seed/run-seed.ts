import { NestFactory } from '@nestjs/core';
import { DatabaseCliModule } from '../cli.module.js';
import { DRIZZLE, Database } from '../database.types.js';
import { seed } from './seed.js';

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(DatabaseCliModule, {
    logger: ['error'],
  });
  try {
    const result = await seed(ctx.get<Database>(DRIZZLE));
    console.log(`Seeded business ${result.businessId}\n`);
    console.table(
      result.logins.map(({ type, role, name, email, password }) => ({
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
