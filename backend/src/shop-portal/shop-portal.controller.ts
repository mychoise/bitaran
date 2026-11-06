import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { ShopTokenPayload } from '../common/decorators/current-user.decorator.js';
import { ShopOnly } from '../common/decorators/user-type.decorator.js';
import {
  ShopInvoicesQueryDto,
  ShopPaymentsQueryDto,
  ShopRangeQueryDto,
} from './dto/shop-portal.dto.js';
import { ShopPortalService } from './shop-portal.service.js';

/** A logged-in shop's own invoices, payments and returns. No id is taken for the shop. */
@ApiTags('shop')
@ApiBearerAuth()
@ShopOnly()
@Controller('shop/me')
export class ShopPortalController {
  constructor(private readonly portal: ShopPortalService) {}

  @Get('invoices')
  invoices(
    @CurrentUser() shop: ShopTokenPayload,
    @Query() query: ShopInvoicesQueryDto,
  ) {
    return this.portal.invoices(shop.sub, query);
  }

  @Get('invoices/:id')
  invoice(
    @CurrentUser() shop: ShopTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.invoice(shop.sub, id);
  }

  @Get('payments')
  payments(
    @CurrentUser() shop: ShopTokenPayload,
    @Query() query: ShopPaymentsQueryDto,
  ) {
    return this.portal.payments(shop.sub, query);
  }

  @Get('returns')
  returns(
    @CurrentUser() shop: ShopTokenPayload,
    @Query() query: ShopRangeQueryDto,
  ) {
    return this.portal.returns(shop.sub, query);
  }
}
