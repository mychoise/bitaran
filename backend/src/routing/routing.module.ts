import { Module } from '@nestjs/common';
import { ClientsController, ShopController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({
  controllers: [RoutesController, ClientsController, ShopController],
  providers: [RoutesService, ClientsService],
})
export class RoutingModule {}
