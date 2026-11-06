import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { Trim } from '../../common/validators/transforms.js';
import { StockLineDto } from '../../day-plans/dto/day-plan.dto.js';

export const ORDER_STATUSES = ['open', 'delivered', 'cancelled'] as const;
export const ORDER_PAYMENT_MODES = ['prepaid', 'on_delivery'] as const;

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ format: 'uuid', description: 'The salesman who delivers it' })
  @IsUUID()
  salesmanId: string;

  @ApiProperty({ type: [StockLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items: StockLineDto[];

  @ApiProperty({
    enum: ORDER_PAYMENT_MODES,
    description:
      "'prepaid': the office took the money (give prepaidPaymentId); 'on_delivery': the salesman takes it",
  })
  @IsIn(ORDER_PAYMENT_MODES)
  paymentMode: (typeof ORDER_PAYMENT_MODES)[number];

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'For prepaid: the payment the office recorded for this shop (POST /payments)',
  })
  @IsOptional()
  @IsUUID()
  prepaidPaymentId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who only see their own',
  })
  @IsOptional()
  @IsUUID()
  salesmanId?: string;
}

export class CancelOrderDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;
}
