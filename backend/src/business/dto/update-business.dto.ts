import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import { NormalizeEmail, Trim } from '../../common/validators/transforms.js';

// Required columns may be changed but not cleared; nullable ones accept null.
// pan_number is deliberately absent: unknown fields are rejected, so sending
// it fails validation rather than being silently ignored.
export class UpdateBusinessDto {
  @ApiPropertyOptional()
  @IsOmittable()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOmittable()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOmittable()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Trim()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Trim()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Storage key' })
  @IsNullable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  logoKey?: string | null;
}
