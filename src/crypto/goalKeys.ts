import { fromBase64Url, randomBytes, toBase64Url, utf8Encode } from './cryptoEncoding';
import type { EncryptedContentEnvelope, StaffGoalKeyEnvelope } from './privacyTypes';
import { decryptContent, encryptContent } from './vault';

const subtle = () => {
  if (!globalThis.crypto?.subtle) throw new Error('WEB_CRYPTO_UNAVAILABLE');
  return globalThis.crypto.subtle;
};

const ownerContext = (userId: string, goalId: string, keyVersion: number) => ({ userId, entityType: 'goal-key', entityId: goalId, keyVersion });

export const generateGoalKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export async function wrapGoalKeyForOwner(goalKey: CryptoKey, vaultKey: CryptoKey, userId: string, goalId: string, keyVersion = 1) {
  const rawKey = toBase64Url(await subtle().exportKey('raw', goalKey));
  return encryptContent(vaultKey, { rawKey }, ownerContext(userId, goalId, keyVersion));
}

export async function unwrapGoalKeyForOwner(envelope: EncryptedContentEnvelope, vaultKey: CryptoKey, userId: string, goalId: string) {
  const value = await decryptContent<{ rawKey: string }>(vaultKey, envelope, { userId, entityType: 'goal-key', entityId: goalId });
  return subtle().importKey('raw', fromBase64Url(value.rawKey), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

async function deriveEcdhWrappingKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const material = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8Encode('sopet-goal-share-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function createStaffGoalKeyEnvelope(goalKey: CryptoKey, staffPublicJwk: JsonWebKey, goalId: string, staffUserId: string, keyVersion = 1): Promise<StaffGoalKeyEnvelope> {
  const staffPublicKey = await subtle().importKey('jwk', staffPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveEcdhWrappingKey(ephemeral.privateKey, staffPublicKey, salt);
  const rawGoalKey = await subtle().exportKey('raw', goalKey);
  const aad = utf8Encode(`sopet:goal-share:${goalId}:${staffUserId}:v${keyVersion}`);
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, wrappingKey, rawGoalKey);
  return { version: 1, algorithm: 'ECDH-P256-HKDF-SHA256-AES-256-GCM', keyVersion, ephemeralPublicKey: await subtle().exportKey('jwk', ephemeral.publicKey), salt: toBase64Url(salt), iv: toBase64Url(iv), ciphertext: toBase64Url(ciphertext) };
}

export async function openStaffGoalKeyEnvelope(envelope: StaffGoalKeyEnvelope, privateJwk: JsonWebKey, goalId: string, staffUserId: string) {
  if (envelope.version !== 1 || envelope.algorithm !== 'ECDH-P256-HKDF-SHA256-AES-256-GCM') throw new Error('UNSUPPORTED_KEY_ENVELOPE');
  const privateKey = await subtle().importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const publicKey = await subtle().importKey('jwk', envelope.ephemeralPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const wrappingKey = await deriveEcdhWrappingKey(privateKey, publicKey, new Uint8Array(fromBase64Url(envelope.salt)));
  const aad = utf8Encode(`sopet:goal-share:${goalId}:${staffUserId}:v${envelope.keyVersion}`);
  const raw = await subtle().decrypt({ name: 'AES-GCM', iv: new Uint8Array(fromBase64Url(envelope.iv)), additionalData: aad, tagLength: 128 }, wrappingKey, fromBase64Url(envelope.ciphertext));
  return subtle().importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function createStaffSharingKey(vaultKey: CryptoKey, userId: string) {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privateJwk = await subtle().exportKey('jwk', pair.privateKey);
  return {
    algorithm: 'ECDH-P256-HKDF-SHA256-AES-256-GCM' as const,
    publicKey: await subtle().exportKey('jwk', pair.publicKey),
    wrappedPrivateKey: await encryptContent(vaultKey, { privateJwk }, { userId, entityType: 'staff-sharing-key', entityId: userId, keyVersion: 1 }),
  };
}

export async function unwrapStaffPrivateKey(envelope: EncryptedContentEnvelope, vaultKey: CryptoKey, userId: string) {
  return (await decryptContent<{ privateJwk: JsonWebKey }>(vaultKey, envelope, { userId, entityType: 'staff-sharing-key', entityId: userId })).privateJwk;
}
