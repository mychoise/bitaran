import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class FieldSaleItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  qty!: number;

  @IsOptional()
  price?: unknown;

  @IsOptional()
  unitPricePaisa?: unknown;
}

export class CreateFieldSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FieldSaleItemDto)
  items!: FieldSaleItemDto[];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  customerName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsIn(['CASH', 'ESEWA', 'KHALTI', 'OTHER'])
  paymentMethod: 'CASH' | 'ESEWA' | 'KHALTI' | 'OTHER' = 'CASH';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  note?: string;

  @IsOptional()
  total?: unknown;

  @IsOptional()
  totalPaisa?: unknown;

  @IsOptional()
  price?: unknown;
}
