import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsDateOnly } from '../../common/validators/date-only.js';
import {
  BlankAsMissing,
  ToOptionalNumber,
} from '../../common/validators/transforms.js';

// A location is a pair: sending one coordinate requires the other.
const hasLocation = (o: { lat?: unknown; lng?: unknown }) =>
  o.lat !== undefined || o.lng !== undefined;

/** Multipart form fields sent with the photo (field "photo"). */
export class UploadVisitPhotoDto {
  @ApiPropertyOptional({ description: 'Where the phone was; send with lng' })
  @ToOptionalNumber()
  @ValidateIf(hasLocation)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Send with lat' })
  @ToOptionalNumber()
  @ValidateIf(hasLocation)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ListVisitPhotosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'true: only flagged photos' })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  flagged?: boolean;

  @ApiPropertyOptional({
    example: '2026-10-28',
    description: 'Nepal date the photo was taken',
  })
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  salesmanId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;
}
