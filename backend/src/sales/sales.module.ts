import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module.js';
import {
  ClientSalesController,
  PlanShopsController,
  SalesController,
} from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  controllers: [SalesController, ClientSalesController, PlanShopsController],
  imports: [LedgerModule],
  providers: [SalesService],
})
export class SalesModule {}
