import { IsOptional, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class FieldSaleQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsString()
  fieldSellerId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'VOIDED', 'ALL'])
  status?: 'ACTIVE' | 'VOIDED' | 'ALL';
}

export class FieldAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  fieldSellerId?: string;
}
