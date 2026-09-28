import { IsString, IsEnum, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BarrierCategoryCode, ContentEncoding } from '@prisma/client';

export class BlockActionDto {
  @ApiPropertyOptional({ example: 'I feel completely overwhelmed looking at all 20 catering inquiries at once.' })
  @IsOptional()
  @IsString()
  userExplanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isClientEncrypted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ciphertextExplanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encryptionMetadata?: string;
  @ApiPropertyOptional({ enum: ContentEncoding }) @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;
  @ApiPropertyOptional() @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}

export class ConfirmBarrierDto {
  @ApiProperty({ enum: BarrierCategoryCode, example: BarrierCategoryCode.OVERWHELM })
  @IsEnum(BarrierCategoryCode)
  confirmedCategory: BarrierCategoryCode;

  @ApiPropertyOptional({ enum: ['CONFIRMED', 'MODIFIED', 'REJECTED'], default: 'CONFIRMED' })
  @IsOptional()
  @IsString()
  userConfirmationState?: string;

  @ApiPropertyOptional({ enum: BarrierCategoryCode })
  @IsOptional()
  @IsEnum(BarrierCategoryCode)
  aiSuggestedCategory?: BarrierCategoryCode;

  @ApiPropertyOptional({ example: 'INT_MMA_OVERWHELM' })
  @IsOptional()
  @IsString()
  selectedInterventionCode?: string;
}
