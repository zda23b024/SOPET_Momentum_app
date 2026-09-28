import assert from 'node:assert/strict';
import test from 'node:test';
import { createVault, decryptContent, encryptContent, rotateRecoveryKey, unlockWithPassphrase, unlockWithRecoveryKey } from './vault';

test('encoding, AES-GCM, and passphrase wrapping round-trip', async () => {
  const vault = await createVault('correct horse battery staple');
  const unlocked = await unlockWithPassphrase(vault.metadata, 'correct horse battery staple');
  const context = { userId: 'user-1', entityType: 'goal', entityId: 'goal-1', keyVersion: 1 };
  const encrypted = await encryptContent(unlocked, { title: 'STAGE2_TEST_SECRET_7F31A' }, context);
  const decrypted = await decryptContent<{ title: string }>(unlocked, encrypted, context);
  assert.equal(decrypted.title, 'STAGE2_TEST_SECRET_7F31A');
  assert.equal(encrypted.iv.length > 0, true);
  assert.equal(JSON.stringify(encrypted).includes('STAGE2_TEST_SECRET_7F31A'), false);
});

test('wrong passphrase, tampered ciphertext, and tampered AAD fail', async () => {
  const vault = await createVault('correct horse battery staple');
  await assert.rejects(() => unlockWithPassphrase(vault.metadata, 'incorrect passphrase'), /KEY_UNWRAP_FAILED/);
  const context = { userId: 'user-1', entityType: 'goal', entityId: 'goal-1', keyVersion: 1 };
  const encrypted = await encryptContent(vault.dataKey, { title: 'private' }, context);
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext[0] === 'A' ? 'B' : 'A'}${encrypted.ciphertext.slice(1)}` };
  await assert.rejects(() => decryptContent(vault.dataKey, tampered, context), /DECRYPTION_FAILED/);
  await assert.rejects(() => decryptContent(vault.dataKey, encrypted, { ...context, entityId: 'goal-2' }), /DECRYPTION_FAILED/);
});

test('each encryption uses a unique 96-bit IV', async () => {
  const vault = await createVault('correct horse battery staple');
  const context = { userId: 'user-1', entityType: 'action', entityId: 'action-1', keyVersion: 1 };
  const first = await encryptContent(vault.dataKey, { title: 'same' }, context);
  const second = await encryptContent(vault.dataKey, { title: 'same' }, context);
  assert.notEqual(first.iv, second.iv);
});

test('recovery works and rotation invalidates the old recovery key', async () => {
  const vault = await createVault('correct horse battery staple');
  const recovered = await unlockWithRecoveryKey(vault.metadata, vault.recoveryKey);
  const rotated = await rotateRecoveryKey(recovered, vault.metadata);
  await assert.rejects(() => unlockWithRecoveryKey(rotated.metadata, vault.recoveryKey), /KEY_UNWRAP_FAILED/);
  await unlockWithRecoveryKey(rotated.metadata, rotated.recoveryKey);
});
