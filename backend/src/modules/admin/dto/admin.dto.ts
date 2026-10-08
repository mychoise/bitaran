import { IsString, IsOptional, IsIn } from 'class-validator';

export class ApproveOrgDto {
  @IsString()
  @IsIn(['APPROVED', 'SUSPENDED', 'PENDING'])
  status!: 'APPROVED' | 'SUSPENDED' | 'PENDING';

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class OrgQueryDto {
  @IsString()
  @IsOptional()
  status?: string;
}
