import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateShipmentDto {
  @IsString()
  @IsIn(['PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED'])
  status!: string;

  @IsString()
  @IsOptional()
  courierName?: string;

  @IsString()
  @IsOptional()
  trackingRef?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
