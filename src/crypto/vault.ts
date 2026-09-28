import { fromBase64Url, randomBytes, toBase64Url, utf8Decode, utf8Encode } from './cryptoEncoding';
import type { EncryptedContentEnvelope, VaultKeyMetadata } from './privacyTypes';

export const PBKDF2_ITERATIONS = 600_000;
const RECOVERY_BYTES = 32;

const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error('WEB_CRYPTO_UNAVAILABLE');
  return globalThis.crypto.subtle;
};

async function deriveWrappingKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', utf8Encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function wrapDataKey(dataKey: CryptoKey, secret: string, salt: Uint8Array, iterations: number) {
  const wrappingKey = await deriveWrappingKey(secret, salt, iterations);
  return toBase64Url(await subtle().wrapKey('raw', dataKey, wrappingKey, 'AES-KW'));
}

async function unwrapDataKey(wrapped: string, secret: string, salt: string, iterations: number) {
  try {
    const wrappingKey = await deriveWrappingKey(secret, new Uint8Array(fromBase64Url(salt)), iterations);
    return await subtle().unwrapKey(
      'raw',
      fromBase64Url(wrapped),
      wrappingKey,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new Error('KEY_UNWRAP_FAILED');
  }
}

export async function createVault(passphrase: string): Promise<{
  dataKey: CryptoKey;
  metadata: VaultKeyMetadata;
  recoveryKey: string;
}> {
  if (passphrase.length < 12) throw new Error('PASSPHRASE_TOO_SHORT');
  const dataKey = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const salt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const recoveryKey = toBase64Url(randomBytes(RECOVERY_BYTES));
  const [wrappedKeyData, recoveryWrappedKeyData] = await Promise.all([
    wrapDataKey(dataKey, passphrase, salt, PBKDF2_ITERATIONS),
    wrapDataKey(dataKey, recoveryKey, recoverySalt, PBKDF2_ITERATIONS),
  ]);
  const rawFingerprint = await subtle().digest('SHA-256', await subtle().exportKey('raw', dataKey));
  return {
    // AES-KW rewrapping requires an extractable key. This reference remains memory-only.
    dataKey,
    recoveryKey,
    metadata: {
      keyId: toBase64Url(rawFingerprint), keyVersion: 1, algorithm: 'AES-256-GCM',
      wrappingAlgorithm: 'AES-KW', wrappedKeyData, salt: toBase64Url(salt),
      iterations: PBKDF2_ITERATIONS, kdf: 'PBKDF2', hash: 'SHA-256', metadataVersion: 1,
      recoveryWrappedKeyData, recoverySalt: toBase64Url(recoverySalt),
      recoveryIterations: PBKDF2_ITERATIONS,
    },
  };
}

export const unlockWithPassphrase = (metadata: VaultKeyMetadata, passphrase: string) =>
  unwrapDataKey(metadata.wrappedKeyData, passphrase, metadata.salt, metadata.iterations);

export const unlockWithRecoveryKey = (metadata: VaultKeyMetadata, recoveryKey: string) =>
  unwrapDataKey(metadata.recoveryWrappedKeyData, recoveryKey, metadata.recoverySalt, metadata.recoveryIterations);

export async function rewrapPassphrase(dataKey: CryptoKey, metadata: VaultKeyMetadata, passphrase: string) {
  if (passphrase.length < 12) throw new Error('PASSPHRASE_TOO_SHORT');
  const salt = randomBytes(16);
  return { ...metadata, salt: toBase64Url(salt), wrappedKeyData: await wrapDataKey(dataKey, passphrase, salt, PBKDF2_ITERATIONS), iterations: PBKDF2_ITERATIONS };
}

export async function rotateRecoveryKey(dataKey: CryptoKey, metadata: VaultKeyMetadata) {
  const recoveryKey = toBase64Url(randomBytes(RECOVERY_BYTES));
  const recoverySalt = randomBytes(16);
  return {
    recoveryKey,
    metadata: { ...metadata, recoverySalt: toBase64Url(recoverySalt), recoveryWrappedKeyData: await wrapDataKey(dataKey, recoveryKey, recoverySalt, PBKDF2_ITERATIONS), recoveryIterations: PBKDF2_ITERATIONS },
  };
}

export function buildAad(userId: string, entityType: string, entityId: string, schemaVersion: number) {
  return `sopet:${userId}:${entityType.toLowerCase()}:${entityId}:v${schemaVersion}`;
}

export async function encryptContent<T>(dataKey: CryptoKey, content: T, context: { userId: string; entityType: string; entityId: string; keyVersion: number; schemaVersion?: number }): Promise<EncryptedContentEnvelope> {
  const schemaVersion = context.schemaVersion ?? 1;
  const iv = randomBytes(12);
  const aad = utf8Encode(buildAad(context.userId, context.entityType, context.entityId, schemaVersion));
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, dataKey, utf8Encode(JSON.stringify({ schemaVersion, ...content })));
  return { version: 1, algorithm: 'AES-256-GCM', keyVersion: context.keyVersion, iv: toBase64Url(iv), ciphertext: toBase64Url(ciphertext), aadVersion: 1, schemaVersion };
}

export async function decryptContent<T>(dataKey: CryptoKey, envelope: EncryptedContentEnvelope, context: { userId: string; entityType: string; entityId: string }): Promise<T> {
  if (envelope.version !== 1 || envelope.aadVersion !== 1) throw new Error('UNSUPPORTED_PAYLOAD_VERSION');
  try {
    const aad = utf8Encode(buildAad(context.userId, context.entityType, context.entityId, envelope.schemaVersion));
    const plaintext = await subtle().decrypt({ name: 'AES-GCM', iv: new Uint8Array(fromBase64Url(envelope.iv)), additionalData: aad, tagLength: 128 }, dataKey, fromBase64Url(envelope.ciphertext));
    return JSON.parse(utf8Decode(plaintext)) as T;
  } catch {
    throw new Error('DECRYPTION_FAILED');
  }
}
