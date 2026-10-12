import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
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
  async transitionOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Req() req: Request & { userPermissions?: string[] },
    @Body() dto: TransitionOrderDto,
  ): Promise<unknown> {
    const userPermissions = req.userPermissions || [];
    const statusPermissionMap: Record<string, string> = {
      CONFIRMED: 'order.accept',
      REJECTED_REFUND_PENDING: 'order.reject',
      READY_FOR_PICKUP: 'order.mark_ready',
      REFUNDED: 'order.mark_refunded',
    };
    const required = statusPermissionMap[dto.toStatus];
    if (required && !userPermissions.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    if (
      !required &&
      !userPermissions.some((p) =>
        ['order.accept', 'order.reject', 'order.mark_ready', 'order.mark_refunded'].includes(p),
      )
    ) {
      throw new ForbiddenException('Missing order transition permission');
    }

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
