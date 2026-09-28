import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { ContentEncoding } from '@prisma/client';

export class CreateMilestoneDto {
  @IsString()
  goalId: string;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsDateString()
  targetDate?: string;

  @IsOptional() @IsInt()
  orderIndex?: number;

  @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsBoolean()
  isCompleted?: boolean;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsDateString()
  targetDate?: string;

  @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}
