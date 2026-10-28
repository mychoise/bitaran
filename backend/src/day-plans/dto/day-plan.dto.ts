import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

export const DAY_PLAN_STATUSES = [
  'planned',
  'in_progress',
  'closed',
  'reconciled',
] as const;

export class StockLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({
    enum: STOCK_UNITS,
    description:
      "'base' = the product's own unit; 'carton' = units_per_carton of them",
  })
  @IsIn(STOCK_UNITS)
  unit: StockUnit;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_STOCK)
  quantity: number;
}

export class CreateDayPlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  salesmanId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  routeId: string;

  @ApiProperty({
    example: '2026-10-28',
    description: 'Nepal calendar date (AD)',
  })
  @IsDateOnly()
  planDate: string;

  @ApiProperty({ type: [StockLineDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  stock: StockLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class ListDayPlansQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who only ever see their own plans',
  })
  @IsOptional()
  @IsUUID()
  salesmanId?: string;

  @ApiPropertyOptional({ enum: DAY_PLAN_STATUSES })
  @IsOptional()
  @IsIn(DAY_PLAN_STATUSES)
  status?: (typeof DAY_PLAN_STATUSES)[number];
}
