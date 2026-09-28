import { IsString, IsInt, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ContentEncoding } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMmaDto {
  @ApiProperty({ example: 'Open catering inquiry spreadsheet and read just the first row' })
  @IsOptional() @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 10, default: 15 })
  @IsOptional()
  @IsInt()
  timeframeMinutes?: number;

  @IsOptional() @IsEnum(ContentEncoding)
  contentEncoding?: ContentEncoding;

  @IsOptional() @IsObject()
  encryptedPayload?: Record<string, unknown>;
}
