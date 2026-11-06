import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsDateOnly } from '../../common/validators/date-only.js';
import { PAYMENT_STATUSES } from '../../payments/dto/payment.dto.js';
import { SALE_STATUSES } from '../../sales/dto/sale.dto.js';

export class ShopRangeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Inclusive' })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Inclusive' })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

export class ShopInvoicesQueryDto extends ShopRangeQueryDto {
  @ApiPropertyOptional({ enum: SALE_STATUSES })
  @IsOptional()
  @IsIn(SALE_STATUSES)
  status?: (typeof SALE_STATUSES)[number];
}

export class ShopPaymentsQueryDto extends ShopRangeQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];
}
