import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrgContextGuard } from './common/guards/org-context.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, DrizzleDB } from './db/db.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const reflector = app.get(Reflector);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  const db = app.get<DrizzleDB>(DRIZZLE);

  app.useGlobalGuards(
    new JwtAuthGuard(jwtService, configService, reflector),
    new OrgContextGuard(db, reflector),
    new PermissionsGuard(reflector),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Application running on port ${String(port)}`);
}

void bootstrap();
