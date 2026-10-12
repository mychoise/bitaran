import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VoidFieldSaleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 200, { message: 'Void reason must be between 3 and 200 characters' })
  reason!: string;
}
