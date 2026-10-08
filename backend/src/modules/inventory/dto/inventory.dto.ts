import { IsInt, Min } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  delta!: number;
}
