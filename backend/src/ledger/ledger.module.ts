import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service.js';
import {
  ClientLedgerController,
  ShopLedgerController,
} from './ledger.controller.js';
import { LedgerService } from './ledger.service.js';

@Module({
  controllers: [ClientLedgerController, ShopLedgerController],
  providers: [BalanceService, LedgerService],
  exports: [BalanceService],
})
export class LedgerModule {}
