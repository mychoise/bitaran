import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [StockModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesService, ProductsService],
})
export class CatalogModule {}
