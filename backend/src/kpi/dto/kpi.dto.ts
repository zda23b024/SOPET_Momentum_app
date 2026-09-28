import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ContentEncoding } from '@prisma/client';

export class CreateKpiDto {
  @IsString() goalId: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsNumber() targetValue: number;
  @IsOptional() @IsNumber() currentValue?: number;
  @IsOptional() @IsEnum(ContentEncoding) contentEncoding?: ContentEncoding;
  @IsOptional() @IsObject() encryptedPayload?: Record<string, unknown>;
}

export class RecordKpiValueDto {
  @IsNumber() value: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ContentEncoding) contentEncoding?: ContentEncoding;
  @IsOptional() @IsObject() encryptedPayload?: Record<string, unknown>;
}
