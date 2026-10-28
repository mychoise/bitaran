import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type {
  ShopTokenPayload,
  StaffTokenPayload,
} from '../common/decorators/current-user.decorator.js';
import {
  ShopOnly,
  StaffOnly,
} from '../common/decorators/user-type.decorator.js';
import { IsDateOnly } from '../common/validators/date-only.js';
import { LedgerService } from './ledger.service.js';

export class StatementQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

/** Any staff of the shop's business. */
@ApiTags('ledger')
@ApiBearerAuth()
@StaffOnly()
@Controller('clients')
export class ClientLedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get(':id/balance')
  balance(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ledger.summary(user.businessId, id);
  }

  @Get(':id/statement')
  statement(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.ledger.statement(user.businessId, id, query);
  }
}

/** A logged-in shop's own account. No id is taken: it is always its own. */
@ApiTags('shop')
@ApiBearerAuth()
@ShopOnly()
@Controller('shop/me')
export class ShopLedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('balance')
  async balance(@CurrentUser() shop: ShopTokenPayload) {
    return this.ledger.summary(
      await this.ledger.businessOf(shop.sub),
      shop.sub,
    );
  }

  @Get('statement')
  async statement(
    @CurrentUser() shop: ShopTokenPayload,
    @Query() query: StatementQueryDto,
  ) {
    return this.ledger.statement(
      await this.ledger.businessOf(shop.sub),
      shop.sub,
      query,
    );
  }
}
