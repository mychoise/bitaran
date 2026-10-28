import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Brings the test database up to the latest migration once per run.
 * Runs the real migrate script with NODE_ENV=test, so the config module picks
 * TEST_DATABASE_URL (and refuses if it equals DATABASE_URL). A child process is
 * used because Jest does not apply moduleNameMapper to globalSetup imports.
 */
export default function globalSetup(): void {
  const root = join(__dirname, '..');
  execFileSync(
    join(root, 'node_modules', '.bin', 'tsx'),
    ['src/database/migrate.ts'],
    { cwd: root, env: { ...process.env, NODE_ENV: 'test' }, stdio: 'inherit' },
  );
}
