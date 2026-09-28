export type PrivacyMode = 'STANDARD_PRIVATE' | 'ENCRYPTED_PRIVATE' | 'HIGHLY_CONFIDENTIAL';
export type ContentEncoding = 'PLAINTEXT' | 'CLIENT_ENCRYPTED';

export interface EncryptedContentEnvelope {
  version: 1;
  algorithm: 'AES-256-GCM';
  keyVersion: number;
  iv: string;
  ciphertext: string;
  aadVersion: 1;
  schemaVersion: number;
}

export interface StaffGoalKeyEnvelope {
  version: 1;
  algorithm: 'ECDH-P256-HKDF-SHA256-AES-256-GCM';
  keyVersion: number;
  ephemeralPublicKey: JsonWebKey;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface VaultKeyMetadata {
  keyId: string;
  keyVersion: number;
  algorithm: 'AES-256-GCM';
  wrappingAlgorithm: 'AES-KW';
  wrappedKeyData: string;
  salt: string;
  iterations: number;
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  metadataVersion: 1;
  recoveryWrappedKeyData: string;
  recoverySalt: string;
  recoveryIterations: number;
}

export interface EncryptedRecordInput {
  id: string;
  privacyMode: Exclude<PrivacyMode, 'STANDARD_PRIVATE'>;
  contentEncoding: 'CLIENT_ENCRYPTED';
  encryptedPayload: EncryptedContentEnvelope;
  plaintextContent?: never;
}

export const isProtectedMode = (mode: PrivacyMode) => mode !== 'STANDARD_PRIVATE';
