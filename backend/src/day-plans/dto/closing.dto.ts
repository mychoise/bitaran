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
import { Trim } from '../../common/validators/transforms.js';
import { MAX_STOCK } from '../../stock/stock.service.js';
import { STOCK_UNITS } from '../../stock/units.js';
import type { StockUnit } from '../../stock/units.js';

class LineRef {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ enum: STOCK_UNITS })
  @IsIn(STOCK_UNITS)
  unit: StockUnit;
}

export class ReturnedLineDto extends LineRef {
  @ApiProperty({ minimum: 0, description: 'In the line’s own unit' })
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  quantityReturned: number;
}

export class CountedLineDto extends LineRef {
  @ApiProperty({ minimum: 0, description: 'In the line’s own unit' })
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  quantityCounted: number;
}

export class CloseDayPlanDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  cashHandedOverPaisa: number;

  @ApiProperty({
    type: [ReturnedLineDto],
    description:
      'One entry for every stock line on the plan (0 if none came back)',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReturnedLineDto)
  returned: ReturnedLineDto[];
}

export class ReconcileDayPlanDto {
  @ApiProperty({
    type: [CountedLineDto],
    description: 'One entry for every stock line on the plan',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CountedLineDto)
  counted: CountedLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}
