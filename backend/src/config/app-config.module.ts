import { ConfigModule, ConfigService } from '@nestjs/config';
import { Env, validateEnv } from './env.validation.js';

/** Global, validated configuration. The only place env vars are read. */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: validateEnv,
});

export type AppConfigService = ConfigService<Env, true>;

/** The database the app talks to: the test database when NODE_ENV=test. */
export function databaseUrl(config: AppConfigService): string {
  return config.get('NODE_ENV', { infer: true }) === 'test'
    ? config.get('TEST_DATABASE_URL', { infer: true })!
    : config.get('DATABASE_URL', { infer: true });
}
