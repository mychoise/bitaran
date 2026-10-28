import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/validators/transforms.js';

export class LoginDto {
  @ApiProperty({ example: 'owner@asva.test' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Owner@12345' })
  @IsString()
  @MinLength(1)
  // Bounds the work argon2 does on attacker-supplied input.
  @MaxLength(128)
  password: string;
}
