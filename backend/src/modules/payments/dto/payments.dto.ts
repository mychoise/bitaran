import { IsString, IsIn } from 'class-validator';

export class PaymentCallbackDto {
  @IsString()
  paymentId!: string;

  @IsString()
  @IsIn(['pay', 'fail'])
  action!: 'pay' | 'fail';
}
