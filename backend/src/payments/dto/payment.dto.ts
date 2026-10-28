import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsDateOnly } from '../../common/validators/date-only.js';
import { BlankAsMissing } from '../../common/validators/transforms.js';

export const PAYMENT_METHODS = ['cash', 'cheque', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ['pending', 'confirmed', 'bounced'] as const;

/**
 * Proof images arrive as multipart files, one form field per kind. Which
 * kinds each method may carry, and how many of each.
 */
export const IMAGE_FIELDS = [
  { name: 'cheque_front', maxCount: 1 },
  { name: 'cheque_back', maxCount: 1 },
  { name: 'online_screenshot', maxCount: 3 },
  { name: 'other', maxCount: 3 },
] as const;
export type ImageKind = (typeof IMAGE_FIELDS)[number]['name'];
export const KINDS_FOR: Record<PaymentMethod, ImageKind[]> = {
  cash: ['other'],
  cheque: ['cheque_front', 'cheque_back', 'other'],
  online: ['online_screenshot', 'other'],
};

// Sent as multipart form fields (all strings) or JSON. Blank optional fields
// count as missing; numbers are converted.
export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Must be this shop’s sale',
  })
  @BlankAsMissing()
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Salesmen: defaults to (and must be) their running plan. Managers/owners: optional.',
  })
  @BlankAsMissing()
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountPaisa: number;

  @ApiPropertyOptional({ description: 'Required for cheques' })
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  chequeNumber?: string;

  @ApiPropertyOptional()
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  chequeBank?: string;

  @ApiPropertyOptional({ example: '2026-11-05' })
  @BlankAsMissing()
  @IsOptional()
  @IsDateOnly()
  chequeDate?: string;

  @ApiPropertyOptional({ description: 'Bank or wallet transaction reference' })
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @ApiPropertyOptional()
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: ['confirmed', 'bounced'] })
  @IsIn(['confirmed', 'bounced'])
  status: 'confirmed' | 'bounced';
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Received on or after (Nepal date)',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Received on or before (Nepal date)',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Who collected it. Ignored for salesmen, who see only their own.',
  })
  @IsOptional()
  @IsUUID()
  collectedBy?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];
}
