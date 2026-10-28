import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import {
  DayPlansController,
  VisitPhotosController,
  VisitsController,
} from './day-plans.controller.js';
import { ClosingService } from './closing.service.js';
import { DayPlansService } from './day-plans.service.js';
import { VisitPhotosService } from './visit-photos.service.js';
import { VisitsService } from './visits.service.js';

@Module({
  imports: [StockModule],
  controllers: [DayPlansController, VisitsController, VisitPhotosController],
  providers: [
    DayPlansService,
    VisitsService,
    ClosingService,
    VisitPhotosService,
  ],
})
export class DayPlansModule {}
