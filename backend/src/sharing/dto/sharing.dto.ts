import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { GoalAccessPermission } from '@prisma/client';
import { Type } from 'class-transformer';

export class GrantGoalAccessDto {
  @IsUUID()
  granteeUserId: string;

  @IsEnum(GoalAccessPermission)
  permission: GoalAccessPermission = GoalAccessPermission.VIEW;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportPurpose?: string;

  @IsOptional()
  @IsString()
  encryptedKeyEnvelope?: string;

  @IsOptional()
  encryptionMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  highlyConfidentialConfirmation?: boolean;
}

export class RequestGoalAccessDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class ApproveGoalAccessRequestDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  encryptedKeyEnvelope?: string;

  @IsOptional()
  encryptionMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  highlyConfidentialConfirmation?: boolean;
}

export class RegisterSharingKeyDto {
  @IsString()
  algorithm: string;

  @IsString()
  publicKey: string;

  @IsObject()
  wrappedPrivateKey: Record<string, unknown>;

  @IsObject()
  privateKeyMetadata: Record<string, unknown>;
}

export class RotatedRecordDto {
  @IsString() id: string;
  @IsObject() encryptedPayload: Record<string, unknown>;
}

export class RotatedGrantEnvelopeDto {
  @IsString() grantId: string;
  @IsString() granteeUserId: string;
  @IsString() encryptedKeyEnvelope: string;
  @IsObject() encryptionMetadata: Record<string, unknown>;
}

export class CommitEncryptedRevocationDto {
  @IsString() rotationId: string;
  @IsInt() previousGoalKeyVersion: number;
  @IsInt() goalKeyVersion: number;
  @IsObject() ownerWrappedGoalKey: Record<string, unknown>;
  @IsObject() goalEncryptedPayload: Record<string, unknown>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedGrantEnvelopeDto) remainingGrantEnvelopes: RotatedGrantEnvelopeDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) milestones: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) actions: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) nmaRecords: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) readinessAssessments: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) barriers: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) actionInterventions: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) mmas: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) interruptions: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) restarts: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) kpis: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) kpiValues: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) weeklyReviews: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) lessons: RotatedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => RotatedRecordDto) adjustments: RotatedRecordDto[];
}

export class FailEncryptedRevocationDto {
  @IsString() rotationId: string;
  @IsString() @MaxLength(100) errorCode: string;
}
