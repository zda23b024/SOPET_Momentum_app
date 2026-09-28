import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class SaveVaultMetadataDto {
  @IsString() keyId: string;
  @IsInt() @Min(1) keyVersion: number;
  @IsIn(['AES-256-GCM']) algorithm: 'AES-256-GCM';
  @IsIn(['AES-KW']) wrappingAlgorithm: 'AES-KW';
  @IsString() wrappedKeyData: string;
  @IsString() salt: string;
  @IsInt() @Min(100_000) iterations: number;
  @IsIn(['PBKDF2']) kdf: 'PBKDF2';
  @IsIn(['SHA-256']) hash: 'SHA-256';
  @IsInt() @Min(1) metadataVersion: number;
  @IsString() recoveryWrappedKeyData: string;
  @IsString() recoverySalt: string;
  @IsInt() @Min(100_000) recoveryIterations: number;
}

