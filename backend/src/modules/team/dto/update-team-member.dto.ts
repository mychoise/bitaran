import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['MANAGER', 'STAFF'], { message: 'Role must be MANAGER or STAFF' })
  role?: 'MANAGER' | 'STAFF';
}
