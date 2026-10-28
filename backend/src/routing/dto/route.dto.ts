import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import { Trim } from '../../common/validators/transforms.js';

export const MAX_ROUTE_STOPS = 500;

export class CreateRouteDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'false deactivates; nothing is deleted' })
  @IsOmittable()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRouteDto extends PartialType(CreateRouteDto, {
  skipNullProperties: false,
}) {}

export class SetRouteClientsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Shops in visiting order; sequence is the array index',
  })
  @IsArray()
  @ArrayMaxSize(MAX_ROUTE_STOPS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  clientIds: string[];
}

export class ListRoutesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
