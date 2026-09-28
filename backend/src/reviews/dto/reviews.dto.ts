import { IsString, IsOptional, IsBoolean, IsDateString, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentEncoding } from '@prisma/client';

export class CreateWeeklyReviewDto {
  @ApiProperty({ example: 'goal-amina-primary' })
  @IsString()
  goalId: string;

  @ApiPropertyOptional({ example: '2026-09-20' })
  @IsOptional()
  @IsDateString()
  weekEndingDate?: string;

  @ApiPropertyOptional({ description: '1. What meaningful progress was made toward the primary goal?' })
  @IsOptional()
  @IsString()
  meaningfulProgress?: string;

  @ApiPropertyOptional({ description: '2. Which actions actually mattered vs avoidant busywork?' })
  @IsOptional()
  @IsString()
  actionsThatMattered?: string;

  @ApiPropertyOptional({ description: '3. What got in the way (internal friction, external conditions)?' })
  @IsOptional()
  @IsString()
  whatGotInTheWay?: string;

  @ApiPropertyOptional({ description: '4a. Which interventions or MMA techniques helped?' })
  @IsOptional()
  @IsString()
  interventionsThatHelped?: string;

  @ApiPropertyOptional({ description: '4b. What did NOT help?' })
  @IsOptional()
  @IsString()
  interventionsThatDidNotHelp?: string;

  @ApiPropertyOptional({ description: '5a. Did an interruption occur?' })
  @IsOptional()
  @IsBoolean()
  interruptionExperienced?: boolean;

  @ApiPropertyOptional({ description: '5b. How quickly was momentum resumed?' })
  @IsOptional()
  @IsString()
  restartDetails?: string;

  @ApiPropertyOptional({ description: 'What is the Next Meaningful Action (NMA) anchored for next week?' })
  @IsOptional()
  @IsString()
  nextNmaTitle?: string;

  @ApiPropertyOptional({ description: 'Personal lesson extracted from this week’s execution rhythm' })
  @IsOptional()
  @IsString()
  extractedLesson?: string;

  @ApiPropertyOptional({ description: 'Concrete adjustment for next cycle' })
  @IsOptional()
  @IsString()
  concreteAdjustment?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  aiSummaryDraft?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  aiSummaryConfirmed?: boolean;

  // Privacy / Encryption
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
  @ApiPropertyOptional({ enum: ContentEncoding }) @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;
  @ApiPropertyOptional() @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}
