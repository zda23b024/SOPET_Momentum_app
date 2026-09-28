import { UserRoleType } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn } from 'class-validator';

export class SetAccountStatusDto {
  @IsBoolean()
  isActive: boolean;
}

export class ChangeUserRoleDto {
  @IsEnum(UserRoleType)
  role: UserRoleType;

  @IsIn(['assign', 'revoke'])
  action: 'assign' | 'revoke';
}
