import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import {
  ClientReturnsController,
  ReturnsController,
  WriteOffsController,
} from './returns.controller.js';
import { ReturnsService } from './returns.service.js';
import { WriteOffsService } from './write-offs.service.js';

@Module({
  imports: [StockModule],
  controllers: [
    ReturnsController,
    ClientReturnsController,
    WriteOffsController,
  ],
  providers: [ReturnsService, WriteOffsService],
})
export class ReturnsModule {}
