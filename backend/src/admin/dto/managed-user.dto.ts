import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const MANAGED_ROLES = ['USER', 'ADMIN', 'OWNER'] as const;

export class CreateManagedUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsIn(MANAGED_ROLES)
  role!: typeof MANAGED_ROLES[number];
}

export class UpdateManagedUserRoleDto {
  @IsIn(MANAGED_ROLES)
  role!: typeof MANAGED_ROLES[number];
}
