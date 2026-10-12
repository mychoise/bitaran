import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FieldService } from './field.service';
import { CreateFieldSellerDto } from './dto/create-field-seller.dto';
import { UpdateFieldSellerDto } from './dto/update-field-seller.dto';
import { VoidFieldSaleDto } from './dto/void-field-sale.dto';
import { FieldSaleQueryDto, FieldAnalyticsQueryDto } from './dto/field-query.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import type { Organization } from '../orgs/orgs.types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('seller')
export class SellerFieldController {
  constructor(private readonly fieldService: FieldService) {}

  @RequirePermission('fieldseller.manage')
  @Post('field-sellers')
  async createFieldSeller(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Body() dto: CreateFieldSellerDto,
  ) {
    return this.fieldService.createFieldSeller(user.sub, org.id, dto);
  }

  @RequirePermission('fieldseller.manage')
  @Get('field-sellers')
  async listFieldSellers(@CurrentOrg() org: Organization) {
    return this.fieldService.listFieldSellers(org.id);
  }

  @RequirePermission('fieldseller.manage')
  @Get('field-sellers/:id')
  async getFieldSeller(
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
  ) {
    return this.fieldService.getFieldSeller(org.id, id);
  }

  @RequirePermission('fieldseller.manage')
  @Patch('field-sellers/:id')
  async updateFieldSeller(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
    @Body() dto: UpdateFieldSellerDto,
  ) {
    return this.fieldService.updateFieldSeller(org.id, id, dto, user.sub);
  }

  @RequirePermission('fieldseller.manage')
  @Post('field-sellers/:id/disable')
  async disableFieldSeller(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
  ) {
    return this.fieldService.disableFieldSeller(org.id, id, user.sub);
  }

  @RequirePermission('fieldseller.manage')
  @Post('field-sellers/:id/enable')
  async enableFieldSeller(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
  ) {
    return this.fieldService.enableFieldSeller(org.id, id, user.sub);
  }

  @RequirePermission('fieldseller.manage')
  @Post('field-sellers/:id/reset-password')
  async resetPassword(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
  ) {
    return this.fieldService.resetPassword(org.id, id, user.sub);
  }

  @RequirePermission('fieldsale.view_all')
  @Get('field-sales')
  async listFieldSales(
    @CurrentOrg() org: Organization,
    @Query() query: FieldSaleQueryDto,
  ) {
    return this.fieldService.listSellerFieldSales(org.id, query);
  }

  @RequirePermission('fieldsale.void')
  @Post('field-sales/:id/void')
  async voidSale(
    @CurrentUser() user: JwtPayload,
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
    @Body() dto: VoidFieldSaleDto,
  ) {
    return this.fieldService.voidSale(org.id, id, user.sub, dto);
  }

  @RequirePermission('fieldanalytics.view')
  @Get('field-analytics')
  async getFieldAnalytics(
    @CurrentOrg() org: Organization,
    @Query() query: FieldAnalyticsQueryDto,
  ) {
    return this.fieldService.getFieldAnalytics(org.id, query);
  }
}
