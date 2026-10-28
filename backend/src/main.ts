import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './config/app-config.module.js';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get<AppConfigService>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
