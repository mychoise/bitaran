import { IsString, IsInt, Min } from 'class-validator';

export class UpsertCartItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class RemoveCartItemDto {
  @IsString()
  variantId!: string;
}
