import { IsArray, IsInt, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MigratedRecordDto {
  @IsString()
  id: string;

  @IsObject()
  encryptedPayload: Record<string, unknown>;
}

export class FailGoalKeyMigrationDto {
  @IsString() migrationId: string;
  @IsString() errorCode: string;
}

export class CommitGoalKeyMigrationDto {
  @IsString()
  migrationId: string;

  @IsInt()
  goalKeyVersion: number;

  @IsObject()
  ownerWrappedGoalKey: Record<string, unknown>;

  @IsObject()
  goalEncryptedPayload: Record<string, unknown>;

  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  milestones: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  actions: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  nmaRecords: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  readinessAssessments: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  barriers: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  actionInterventions: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  mmas: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  interruptions: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  restarts: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  kpis: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  kpiValues: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  weeklyReviews: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  lessons: MigratedRecordDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => MigratedRecordDto)
  adjustments: MigratedRecordDto[];
}
