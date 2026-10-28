import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DRIZZLE, Database } from '../../src/database/database.types.js';
import { MemoryStorage } from '../../src/storage/drivers/memory.storage.js';
import { StorageService } from '../../src/storage/storage.service.js';

export interface TestApp {
  app: INestApplication;
  db: Database;
}

/**
 * Full app (same wiring as main.ts) against the test database. Extra
 * `controllers` are mounted alongside it, e.g. probe routes for guard tests.
 */
export async function createTestApp(
  controllers: Type[] = [],
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    // Whatever STORAGE_DRIVER says, tests never touch disk or Cloudinary.
    .overrideProvider(StorageService)
    .useValue(new MemoryStorage())
    .compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return { app, db: app.get<Database>(DRIZZLE) };
}
