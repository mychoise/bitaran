import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator.js';
import {
  CancelSaleDto,
  CreateSaleDto,
  ListSalesQueryDto,
} from './dto/sale.dto.js';
import { SalesService } from './sales.service.js';

// All staff. Salesmen: their own sales on their own running plan; the
// service enforces that.
@ApiTags('sales')
@ApiBearerAuth()
@StaffOnly()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /**
   * 201 with the new sale, or 200 with the original one (and header
   * Idempotent-Replayed: true) when the Idempotency-Key was seen before.
   */
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique per sale attempt; resend the same key on retry',
  })
  @Post()
  async create(
    @CurrentUser() user: StaffTokenPayload,
    @IdempotencyKey() key: string,
    @Body() body: CreateSaleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sale, replayed } = await this.sales.create(user, body, key);
    if (replayed) {
      res.status(HttpStatus.OK).setHeader('Idempotent-Replayed', 'true');
    }
    return sale;
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.sales.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sales.get(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelSaleDto,
  ) {
    return this.sales.cancel(user, id, body.reason);
  }
}

/** A shop's purchase history. Any staff of the business. */
@ApiTags('sales')
@ApiBearerAuth()
@StaffOnly()
@Controller('clients')
export class ClientSalesController {
  constructor(private readonly sales: SalesService) {}

  @Get(':id/sales')
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.sales.clientSales(user, id, query);
  }

  @Get(':id/items-taken')
  itemsTaken(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sales.itemsTaken(user, id);
  }
}

/** The salesman's route screen. Salesmen: their own plans only. */
@ApiTags('day-plans')
@ApiBearerAuth()
@StaffOnly()
@Controller('day-plans')
export class PlanShopsController {
  constructor(private readonly sales: SalesService) {}

  @Get(':id/shops')
  shops(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sales.planShops(user, id);
  }
}
