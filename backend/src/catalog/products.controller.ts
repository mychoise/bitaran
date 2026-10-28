import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  StockAdjustDto,
  UpdateProductDto,
} from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

// Reads are open to all staff; salesmen get responses without cost price.
@ApiTags('catalog')
@ApiBearerAuth()
@StaffOnly()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.products.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.products.get(user, id);
  }

  @Roles('owner', 'manager')
  @Post()
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateProductDto,
  ) {
    return this.products.create(user, body);
  }

  @Roles('owner', 'manager')
  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.products.update(user, id, body);
  }

  @Roles('owner', 'manager')
  @Post(':id/stock-adjust')
  @HttpCode(HttpStatus.OK)
  adjustStock(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StockAdjustDto,
  ) {
    return this.products.adjustStock(user, id, body.delta);
  }
}
