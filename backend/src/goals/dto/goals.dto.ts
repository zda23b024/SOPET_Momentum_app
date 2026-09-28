import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentEncoding, GoalStatus, PrivacyMode } from '@prisma/client';

export class CreateGoalDto {
  @ApiPropertyOptional({ description: 'Client-generated UUID used for authenticated encryption context' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 'Start a catering business' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Launch an artisan lunch catering service for local offices within 6 months.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Achieve financial independence and express culinary passion.' })
  @IsOptional()
  @IsString()
  whyItMatters?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isClientEncrypted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ciphertextPayload?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encryptionMetadata?: string;

  @ApiPropertyOptional({ enum: PrivacyMode })
  @IsOptional()
  @IsEnum(PrivacyMode)
  privacyMode?: PrivacyMode;

  @ApiPropertyOptional({ enum: ContentEncoding })
  @IsOptional()
  @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  plaintextContent?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  encryptedPayload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Goal data key wrapped by the owner Privacy Vault key' })
  @IsOptional()
  @IsObject()
  ownerWrappedGoalKey?: Record<string, unknown>;
}

export class UpgradeGoalPrivacyDto {
  @IsEnum(PrivacyMode)
  privacyMode: PrivacyMode;

  @IsEnum(ContentEncoding)
  contentEncoding: ContentEncoding;

  @IsObject()
  encryptedPayload: Record<string, unknown>;

  @IsObject()
  ownerWrappedGoalKey: Record<string, unknown>;
}

export class UpdateGoalStatusDto {
  @ApiProperty({ enum: GoalStatus })
  @IsEnum(GoalStatus)
  status: GoalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
