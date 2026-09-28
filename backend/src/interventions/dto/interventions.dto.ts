import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ContentEncoding } from '@prisma/client';

export class ApplyInterventionDto {
  @IsString()
  interventionCode: string;

  @IsOptional() @IsString()
  barrierId?: string;

  @IsOptional() @IsString()
  outcomeNotes?: string;

  @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}
