import type { Config } from 'drizzle-kit';

// Used by drizzle-kit only (generate / studio). The app and the migrate script
// read the database URL through the validated config module.
export default {
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
