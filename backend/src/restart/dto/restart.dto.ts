import { IsBoolean, IsEnum, IsString, IsOptional, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentEncoding, InterruptionType, RestartDecision } from '@prisma/client';

export class RestartProtocolDto {
  @ApiProperty({ enum: InterruptionType, example: InterruptionType.EXTERNAL })
  @IsEnum(InterruptionType)
  interruptionType: InterruptionType;

  @ApiProperty({ example: 'Flu and domestic commitments caused a 5-day pause.' })
  @IsOptional() @IsString()
  causeDescription?: string;

  @ApiProperty({ description: '1. Is the goal still personally meaningful?' })
  @IsBoolean()
  isStillMeaningful: boolean;

  @ApiProperty({ description: '2. What has changed in external reality or energy?' })
  @IsOptional() @IsString()
  whatChanged?: string;

  @ApiProperty({ description: '3. What specifically precipitated the interruption?' })
  @IsOptional() @IsString()
  rootCause?: string;

  @ApiProperty({ description: '4. Is the previous plan realistic going forward?' })
  @IsBoolean()
  isPlanRealistic: boolean;

  @ApiProperty({ enum: RestartDecision, example: RestartDecision.RESUME })
  @IsEnum(RestartDecision)
  restartDecision: RestartDecision;

  @ApiProperty({ example: 'Review today’s catering inquiries list for 15 minutes' })
  @IsOptional() @IsString()
  restartActionTitle?: string;

  @ApiPropertyOptional({ example: 2.0 })
  @IsOptional()
  @IsNumber()
  daysElapsed?: number;

  @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}
