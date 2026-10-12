import { IsNotEmpty, IsString, IsEmail, IsIn } from 'class-validator';

export class CreateTeamMemberDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Valid email is required' })
  email!: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(['MANAGER', 'STAFF'], { message: 'Role must be MANAGER or STAFF' })
  role!: 'MANAGER' | 'STAFF';
}
