import { Module } from '@nestjs/common';
import { ShopPortalController } from './shop-portal.controller.js';
import { ShopPortalService } from './shop-portal.service.js';

@Module({
  controllers: [ShopPortalController],
  providers: [ShopPortalService],
})
export class ShopPortalModule {}
