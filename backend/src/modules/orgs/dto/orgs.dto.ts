import { IsString, IsOptional } from 'class-validator';

export class UpdateOrgStatusDto {
  @IsString()
  status!: 'APPROVED' | 'SUSPENDED' | 'PENDING';
}

export class CreateAddressDto {
  @IsString()
  line1!: string;

  @IsString()
  city!: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsOptional()
  isDefault?: boolean;
}
