import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { AppConfigService } from './config/app-config.module.js';

export const API_PREFIX = 'api/v1';
/** Largest JSON or form body accepted. Uploads have their own limits (multer). */
export const BODY_LIMIT = '256kb';
export const DOCS_PATH = 'docs';

/** App-level setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get<AppConfigService>(ConfigService);
  const express = app as NestExpressApplication;

  app.useLogger(app.get(Logger));
  express.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.use(helmet());
  // An origin not on the list gets no CORS headers, so browsers block it.
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    exposedHeaders: ['Idempotent-Replayed', 'X-Request-Id'],
    maxAge: 600,
  });
  express.useBodyParser('json', { limit: BODY_LIMIT });
  express.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  // OpenAPI docs at /docs (JSON at /docs-json), never in production.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const openApi = new DocumentBuilder()
      .setTitle('Asva Wholesale API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(DOCS_PATH, app, () =>
      SwaggerModule.createDocument(app, openApi),
    );
  }
  return app;
}
