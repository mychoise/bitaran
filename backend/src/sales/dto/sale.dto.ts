import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsDateOnly } from '../../common/validators/date-only.js';
import { Trim } from '../../common/validators/transforms.js';
import { MAX_STOCK } from '../../stock/stock.service.js';
import { STOCK_UNITS } from '../../stock/units.js';
import type { StockUnit } from '../../stock/units.js';

const MAX_PAISA = Number.MAX_SAFE_INTEGER;
export const SALE_STATUSES = ['confirmed', 'cancelled'] as const;

export class SaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ enum: STOCK_UNITS })
  @IsIn(STOCK_UNITS)
  unit: StockUnit;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_STOCK)
  quantity: number;

  // Accepted so older or offline clients that send their own figures are not
  // refused, but never read: prices and totals always come from the database.
  @ApiPropertyOptional({ deprecated: true, description: 'Ignored' })
  @Allow()
  unitPricePaisa?: unknown;

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored' })
  @Allow()
  lineTotalPaisa?: unknown;
}

export class CreateSaleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The visit this sale was made on; must be for the same shop',
  })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Plan whose stock is sold. Salesmen: defaults to their running plan. ' +
      'Managers/owners: required unless visitId is given.',
  })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateOnly()
  dueDate?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  discountPaisa?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Cash received now, up to the sale total; recorded as a payment',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  cashPaidNowPaisa?: number;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored' })
  @Allow()
  totalPaisa?: unknown;

  @ApiPropertyOptional({ deprecated: true, description: 'Ignored' })
  @Allow()
  subtotalPaisa?: unknown;
}

export class CancelSaleDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ListSalesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'sale_date from, inclusive',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'sale_date to, inclusive',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who only see their own sales',
  })
  @IsOptional()
  @IsUUID()
  salesmanId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({ enum: SALE_STATUSES })
  @IsOptional()
  @IsIn(SALE_STATUSES)
  status?: (typeof SALE_STATUSES)[number];
}
