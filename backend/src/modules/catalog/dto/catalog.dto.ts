import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  IsUrl,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  sku!: string;

  @IsString()
  unit!: string;

  @IsInt()
  @Min(1)
  packSize!: number;

  @IsInt()
  @Min(0)
  pricePaisa!: number;

  @IsInt()
  @Min(1)
  minOrderQty!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  @IsOptional()
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  @IsOptional()
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];
}

export class ProductQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  sellerOrgId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['price_asc', 'price_desc'])
  sort?: string;
}
