import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export const LOSS_REASONS = ['damaged', 'expired', 'other'] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export class ReturnItemDto {
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

  @ApiProperty({ enum: LOSS_REASONS })
  @IsIn(LOSS_REASONS)
  reason: LossReason;

  @ApiPropertyOptional({
    default: false,
    description: 'Back on the shelf. Only for reason "other".',
  })
  @IsOptional()
  @IsBoolean()
  restocked?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Managers/owners only. Defaults to the sale’s price (and may not exceed it) or the current price.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  unitPricePaisa?: number;
}

export class CreateReturnDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The sale the goods came from',
  })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Salesmen: defaults to (and must be) their running plan',
  })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

export class ListReturnsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who see only returns they took',
  })
  @IsOptional()
  @IsUUID()
  receivedBy?: string;
}

export class CreateWriteOffDto {
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

  @ApiProperty({ enum: LOSS_REASONS })
  @IsIn(LOSS_REASONS)
  reason: LossReason;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Van stock on this plan (already out of the warehouse). Without it, warehouse stock is reduced. Required for salesmen.',
  })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class ListWriteOffsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({ enum: LOSS_REASONS })
  @IsOptional()
  @IsIn(LOSS_REASONS)
  reason?: LossReason;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who see only their own',
  })
  @IsOptional()
  @IsUUID()
  recordedBy?: string;
}
