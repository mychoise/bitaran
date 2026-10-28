import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import type { UserRole } from '../../common/decorators/roles.decorator.js';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import { NormalizeEmail, Trim } from '../../common/validators/transforms.js';

// 'owner' is accepted by validation on purpose, so that asking for a second
// owner gets a specific SECOND_OWNER error from the service instead of a
// generic "role must be one of" message.
const ROLES: UserRole[] = ['owner', 'manager', 'salesman'];

export class CreateStaffDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ enum: ['manager', 'salesman'] })
  @IsIn(ROLES)
  role: UserRole;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: 'Initial password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOmittable()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOmittable()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Trim()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ enum: ['manager', 'salesman'] })
  @IsOmittable()
  @IsIn(ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'false deactivates; nothing is deleted' })
  @IsOmittable()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword: string;
}

export class ListStaffQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
