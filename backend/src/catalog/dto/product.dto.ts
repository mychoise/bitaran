import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import { Trim } from '../../common/validators/transforms.js';
import { MAX_STOCK } from '../../stock/stock.service.js';

const MAX_PAISA = Number.MAX_SAFE_INTEGER;

/** Integer paisa, zero or more. */
const Paisa = () => (target: object, key: string) => {
  IsInt()(target, key);
  Min(0)(target, key);
  Max(MAX_PAISA)(target, key);
};

/** Integer count of base units, within the integer column's range. */
const Units = (min: number) => (target: object, key: string) => {
  IsInt()(target, key);
  Min(min)(target, key);
  Max(MAX_STOCK)(target, key);
};

const Text = (max: number) => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(max)(target, key);
};

// Nullable columns accept null (to clear); NOT NULL columns may be omitted
// where they have a default, but never sent as null.
export class CreateProductDto {
  @ApiProperty()
  @Text(200)
  name: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsNullable()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(100)
  brand?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Unique per business' })
  @IsNullable()
  @Text(64)
  sku?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(64)
  barcode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Storage key' })
  @IsNullable()
  @Text(500)
  imageKey?: string | null;

  @ApiPropertyOptional({ default: 'piece', description: 'Base unit name' })
  @IsOmittable()
  @Text(30)
  unit?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsNullable()
  @Units(1)
  unitsPerCarton?: number | null;

  @ApiProperty({ minimum: 0 })
  @Paisa()
  pricePaisa: number;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsNullable()
  @Paisa()
  cartonPricePaisa?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsNullable()
  @Paisa()
  mrpPaisa?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsNullable()
  @Paisa()
  costPricePaisa?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsNullable()
  @Units(0)
  lowStockAlert?: number | null;

  @ApiPropertyOptional({
    description: 'false hides the product; nothing is deleted',
  })
  @IsOmittable()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Opening stock in base units. Only settable here.',
  })
  @IsOmittable()
  @Units(0)
  stockQuantity?: number;
}

// stock_quantity is left out: after creation it changes only through
// POST /products/:id/stock-adjust, so sending it on update is a 400.
// skipNullProperties: false keeps null rejected for NOT NULL columns.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['stockQuantity'] as const),
  { skipNullProperties: false },
) {}

export class StockAdjustDto {
  @ApiProperty({
    description: 'Signed change in base units, e.g. 24 or -6',
    example: -6,
  })
  @IsInt()
  @NotEquals(0)
  @Min(-MAX_STOCK)
  @Max(MAX_STOCK)
  delta: number;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, SKU or barcode' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
