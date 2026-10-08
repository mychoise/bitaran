import { IsString, IsOptional, IsIn } from 'class-validator';

export class OrderQueryDto {
  @IsString()
  @IsOptional()
  status?: string;
}

export class TransitionOrderDto {
  @IsString()
  @IsIn([
    'PAID',
    'PAYMENT_FAILED',
    'CANCELLED',
    'CONFIRMED',
    'REJECTED_REFUND_PENDING',
    'REFUNDED',
    'READY_FOR_PICKUP',
    'IN_DELIVERY',
    'DELIVERED',
  ])
  toStatus!: string;

  @IsString()
  @IsOptional()
  note?: string;
}
