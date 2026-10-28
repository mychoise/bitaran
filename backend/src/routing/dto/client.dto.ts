import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import { NormalizeEmail, Trim } from '../../common/validators/transforms.js';

const Text = (max: number) => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(max)(target, key);
};

export class CreateClientDto {
  @ApiProperty()
  @Text(200)
  name: string;

  @ApiProperty({ description: 'Login email; unique across all shops' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: 'Temporary password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(200)
  ownerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(30)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(500)
  address?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    pattern: '^[0-9]{9}$',
    description: 'Unique within the business',
  })
  @IsNullable()
  @Trim()
  @Matches(/^[0-9]{9}$/, { message: 'panNumber must be exactly 9 digits' })
  panNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Storage key' })
  @IsNullable()
  @Text(500)
  panCardImageKey?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Text(100)
  registrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @IsLatitude()
  lat?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @IsLongitude()
  lng?: number | null;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Managers and owners only; forced to 0 for salesmen',
  })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  creditLimitPaisa?: number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Amount owed before using the system (negative = shop is in credit). ' +
      'Managers and owners only; forced to 0 for salesmen',
  })
  @IsOmittable()
  @IsInt()
  @Min(Number.MIN_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  openingBalancePaisa?: number;

  @ApiPropertyOptional({ description: 'false deactivates; nothing is deleted' })
  @IsOmittable()
  @IsBoolean()
  isActive?: boolean;
}

// Password changes go through reset-password, not PATCH.
export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ['password'] as const),
  { skipNullProperties: false },
) {}

/** Fields only managers and owners may set. */
export const MANAGER_ONLY_CLIENT_FIELDS = [
  'creditLimitPaisa',
  'openingBalancePaisa',
  'isActive',
] as const;

export class ResetClientPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword: string;
}

export class ListClientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Matches name, owner, phone, email or PAN',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Shops on this route' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
