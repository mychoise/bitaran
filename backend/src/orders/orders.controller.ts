import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import {
  CancelOrderDto,
  CreateOrderDto,
  ListOrdersQueryDto,
} from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

// Owners and managers take and cancel orders; a salesman reads the ones he
// delivers. Delivery is a sale with this order's id (POST /sales).
@ApiTags('orders')
@ApiBearerAuth()
@StaffOnly()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles('owner', 'manager')
  @Post()
  create(@CurrentUser() user: StaffTokenPayload, @Body() body: CreateOrderDto) {
    return this.orders.create(user, body);
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orders.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.get(user, id);
  }

  @Roles('owner', 'manager')
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelOrderDto,
  ) {
    return this.orders.cancel(user, id, body.reason);
  }
}
