import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsIn(['en'])
  locale?: 'en';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  emailWeeklyReview?: boolean;

  @IsOptional()
  @IsBoolean()
  emailRestartReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppNmaPrompts?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppBarrierCheckins?: boolean;
}
