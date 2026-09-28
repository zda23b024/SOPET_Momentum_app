import { BadRequestException } from '@nestjs/common';
import { assertNoPrivacyDowngrade, PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';

const payload = { version: 1, algorithm: 'AES-256-GCM', keyVersion: 1, iv: 'iv', ciphertext: 'ciphertext', aadVersion: 1, schemaVersion: 1 };

describe('privacy content boundary', () => {
  it('accepts encrypted-only content', () => {
    expect(() => validateEncryptedContent({ contentEncoding: 'CLIENT_ENCRYPTED', encryptedPayload: payload }, PRIVATE_FIELDS.goal)).not.toThrow();
  });

  it('rejects plaintext duplication', () => {
    expect(() => validateEncryptedContent({ contentEncoding: 'CLIENT_ENCRYPTED', encryptedPayload: payload, title: 'secret' }, PRIVATE_FIELDS.goal)).toThrow(BadRequestException);
  });

  it('rejects privacy downgrade', () => {
    expect(() => assertNoPrivacyDowngrade('HIGHLY_CONFIDENTIAL', 'ENCRYPTED_PRIVATE')).toThrow(BadRequestException);
  });
});

