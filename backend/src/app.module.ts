import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { BusinessModule } from './business/business.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DayPlansModule } from './day-plans/day-plans.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { THROTTLES } from './common/throttle.js';
import { createValidationPipe } from './common/validation.js';
import {
  AppConfigModule,
  AppConfigService,
} from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { RoutingModule } from './routing/routing.module.js';
import { SalesModule } from './sales/sales.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StorageModule } from './storage/storage.module.js';

const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Reuse a sane incoming request id, otherwise mint one; echo it back.
          genReqId: (req, res) => {
            const incoming = req.headers[REQUEST_ID_HEADER];
            const id =
              typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    // Applied per route (login, uploads) by the decorators in common/throttle.
    ThrottlerModule.forRoot(THROTTLES),
    DatabaseModule,
    StorageModule,
    AuthModule,
    BusinessModule,
    StaffModule,
    CatalogModule,
    RoutingModule,
    DayPlansModule,
    SalesModule,
    LedgerModule,
    PaymentsModule,
    ReturnsModule,
    ExpensesModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
