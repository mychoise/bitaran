import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { FieldService } from './field.service';
import { CreateFieldSaleDto } from './dto/create-field-sale.dto';
import { FieldSaleQueryDto } from './dto/field-query.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { Organization } from '../orgs/orgs.types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('field')
export class FieldController {
  constructor(private readonly fieldService: FieldService) {}

  @RequirePermission('fieldsale.view_own')
  @Get('me/summary')
  async getSummary(@CurrentUser() user: JwtPayload) {
    return this.fieldService.getSummary(user.sub);
  }

  @RequirePermission('fieldcatalog.view')
  @Get('products')
  async getProducts(@CurrentOrg() org: Organization) {
    return this.fieldService.getProducts(org.id);
  }

  @RequirePermission('fieldsale.create')
  @Post('sales')
  async createSale(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Body() dto: CreateFieldSaleDto,
  ) {
    return this.fieldService.createSale(user.sub, org.id, dto);
  }

  @RequirePermission('fieldsale.view_own')
  @Get('sales')
  async getSales(
    @CurrentUser() user: JwtPayload,
    @Query() query: FieldSaleQueryDto,
  ) {
    return this.fieldService.getOwnSales(user.sub, query);
  }
}
