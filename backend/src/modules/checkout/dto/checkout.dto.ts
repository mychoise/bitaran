import { IsString, IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  addressId!: string;

  @IsString()
  @IsIn(['ESEWA', 'KHALTI'])
  paymentProvider!: 'ESEWA' | 'KHALTI';
}
