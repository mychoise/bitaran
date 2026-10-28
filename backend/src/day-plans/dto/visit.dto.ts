import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsNullable } from '../../common/validators/optional.js';
import { Trim } from '../../common/validators/transforms.js';

export const VISIT_OUTCOMES = ['visited', 'skipped'] as const;

// A location is a pair: sending one coordinate requires the other.
const hasLocation = (o: { lat?: unknown; lng?: unknown }) =>
  o.lat !== undefined || o.lng !== undefined;

export class UpdateVisitDto {
  @ApiProperty({ enum: VISIT_OUTCOMES })
  @IsIn(VISIT_OUTCOMES)
  status: (typeof VISIT_OUTCOMES)[number];

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @Trim()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({ description: 'Send with lng' })
  @ValidateIf(hasLocation)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Send with lat' })
  @ValidateIf(hasLocation)
  @IsLongitude()
  lng?: number;
}

export class AddVisitDto {
  @ApiProperty({ format: 'uuid', description: 'The shop to add' })
  @IsUUID()
  clientId: string;
}
