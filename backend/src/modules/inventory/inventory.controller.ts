import {
  Controller,
  Get,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/inventory.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Organization } from '../orgs/orgs.types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @RequirePermission('product.view')
  async listStock(@CurrentOrg() org: Organization): Promise<unknown[]> {
    return this.inventoryService.listStock(org.id);
  }

  @Post('stock/:variantId/adjust')
  @RequirePermission('product.edit')
  async adjustStock(
    @Param('variantId') variantId: string,
    @CurrentOrg() org: Organization,
    @Body() dto: AdjustStockDto,
  ): Promise<unknown> {
    return this.inventoryService.adjustStock(variantId, org.id, dto.delta);
  }
}
