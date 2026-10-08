import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderQueryDto, TransitionOrderDto } from './dto/orders.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Organization } from '../orgs/orgs.types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('buyer')
  async listBuyerOrders(
    @CurrentOrg() org: Organization,
    @Query() query: OrderQueryDto,
  ): Promise<unknown[]> {
    return this.ordersService.listBuyerOrders(org.id, query.status);
  }

  @Get('seller')
  @RequirePermission('order.view')
  async listSellerOrders(
    @CurrentOrg() org: Organization,
    @Query() query: OrderQueryDto,
  ): Promise<unknown[]> {
    return this.ordersService.listSellerOrders(org.id, query.status);
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @CurrentOrg() org: Organization,
  ): Promise<unknown> {
    return this.ordersService.getOrder(id, org.id);
  }

  @Post(':id/transition')
  @RequirePermission('order.accept')
  async transitionOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Body() dto: TransitionOrderDto,
  ): Promise<unknown> {
    return this.ordersService.transitionOrder(
      id,
      dto.toStatus as Parameters<typeof this.ordersService.transitionOrder>[1],
      user.sub,
      org.id,
      false,
      dto.note,
    );
  }
}
