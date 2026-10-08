import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { UpdateShipmentDto } from './dto/shipments.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @RequirePermission('shipment.update')
  async listShipments(): Promise<unknown[]> {
    return this.shipmentsService.listShipments();
  }

  @Get(':id')
  async getShipment(@Param('id') id: string): Promise<unknown> {
    return this.shipmentsService.getShipment(id);
  }

  @Post('orders/:orderId')
  @RequirePermission('shipment.update')
  async createShipment(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.shipmentsService.createShipmentForOrder(orderId, user.sub);
  }

  @Put(':id')
  @RequirePermission('shipment.update')
  async updateShipment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShipmentDto,
  ): Promise<unknown> {
    return this.shipmentsService.updateShipment(
      id,
      dto.status as Parameters<typeof this.shipmentsService.updateShipment>[1],
      user.sub,
      dto.courierName,
      dto.trackingRef,
      dto.note,
    );
  }
}
