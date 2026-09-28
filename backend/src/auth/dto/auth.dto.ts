import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'amina@example.com' })
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @ApiProperty({ example: 'SopetPilot2026!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({ example: 'Amina (Pilot Participant)' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: ['STANDARD_PRIVATE', 'ENCRYPTED_PRIVATE', 'HIGHLY_CONFIDENTIAL'] })
  @IsOptional()
  @IsEnum(['STANDARD_PRIVATE', 'ENCRYPTED_PRIVATE', 'HIGHLY_CONFIDENTIAL'])
  privacyMode?: 'STANDARD_PRIVATE' | 'ENCRYPTED_PRIVATE' | 'HIGHLY_CONFIDENTIAL';
}

export class LoginDto {
  @ApiProperty({ example: 'amina@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SopetPilot2026!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '6-digit TOTP code if MFA is enabled' })
  @IsOptional()
  @IsString()
  totpCode?: string;

  @ApiPropertyOptional({ description: 'Single-use recovery code if TOTP is unavailable' })
  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class ConfirmMfaDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  totpCode: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refreshToken: string;
}

export class MfaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  totpCode: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'amina@example.com' })
  @IsEmail()
  email: string;
}

export class ManageMfaDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsOptional()
  @IsString()
  totpCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'amina@example.com' })
  @IsEmail()
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(12)
  newPassword: string;
}
