import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaffGoalKeyEnvelope, createStaffSharingKey, generateGoalKey, openStaffGoalKeyEnvelope, unwrapGoalKeyForOwner, unwrapStaffPrivateKey, wrapGoalKeyForOwner } from './goalKeys';
import { createVault, decryptContent, encryptContent } from './vault';

test('a per-goal key round trips through owner and staff-specific envelopes', async () => {
  const ownerVault = await createVault('owner passphrase 123');
  const staffVault = await createVault('staff passphrase 123');
  const goalKey = await generateGoalKey();
  const encrypted = await encryptContent(goalKey, { title: 'Selective secret' }, { userId: 'owner-1', entityType: 'goal', entityId: 'goal-1', keyVersion: 1 });
  const ownerEnvelope = await wrapGoalKeyForOwner(goalKey, ownerVault.dataKey, 'owner-1', 'goal-1');
  const ownerGoalKey = await unwrapGoalKeyForOwner(ownerEnvelope, ownerVault.dataKey, 'owner-1', 'goal-1');
  assert.equal((await decryptContent<{ title: string }>(ownerGoalKey, encrypted, { userId: 'owner-1', entityType: 'goal', entityId: 'goal-1' })).title, 'Selective secret');

  const staffKeys = await createStaffSharingKey(staffVault.dataKey, 'staff-1');
  const privateJwk = await unwrapStaffPrivateKey(staffKeys.wrappedPrivateKey, staffVault.dataKey, 'staff-1');
  const staffEnvelope = await createStaffGoalKeyEnvelope(goalKey, staffKeys.publicKey, 'goal-1', 'staff-1');
  const staffGoalKey = await openStaffGoalKeyEnvelope(staffEnvelope, privateJwk, 'goal-1', 'staff-1');
  assert.equal((await decryptContent<{ title: string }>(staffGoalKey, encrypted, { userId: 'owner-1', entityType: 'goal', entityId: 'goal-1' })).title, 'Selective secret');
});

test('a staff key envelope cannot be opened for another staff identity', async () => {
  const vault = await createVault('staff passphrase 123');
  const staffKeys = await createStaffSharingKey(vault.dataKey, 'staff-1');
  const privateJwk = await unwrapStaffPrivateKey(staffKeys.wrappedPrivateKey, vault.dataKey, 'staff-1');
  const envelope = await createStaffGoalKeyEnvelope(await generateGoalKey(), staffKeys.publicKey, 'goal-1', 'staff-1');
  await assert.rejects(() => openStaffGoalKeyEnvelope(envelope, privateJwk, 'goal-1', 'staff-2'));
});
