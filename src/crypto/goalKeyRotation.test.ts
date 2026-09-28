import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoalKeyRotation, GoalRotationSnapshot } from './goalKeyRotation';
import { createStaffGoalKeyEnvelope, createStaffSharingKey, generateGoalKey, openStaffGoalKeyEnvelope, unwrapGoalKeyForOwner, unwrapStaffPrivateKey, wrapGoalKeyForOwner } from './goalKeys';
import { createVault, decryptContent, encryptContent } from './vault';
import { MIGRATION_COLLECTIONS } from './legacyGoalMigration';
import type { StaffGoalKeyEnvelope } from './privacyTypes';

test('rotation excludes revoked admin while owner and remaining admin retain access', async () => {
  const ownerId = 'owner-1'; const goalId = 'goal-1'; const secret = 'private goal text';
  const vault = await createVault('correct horse battery staple');
  const oldKey = await generateGoalKey();
  const ownerEnvelope = await wrapGoalKeyForOwner(oldKey, vault.dataKey, ownerId, goalId, 1);
  const oldGoal = await encryptContent(oldKey, { title: secret }, { userId: ownerId, entityType: 'goal', entityId: goalId, keyVersion: 1 });
  const revokedKeys = await createStaffSharingKey(vault.dataKey, 'admin-a');
  const remainingKeys = await createStaffSharingKey(vault.dataKey, 'admin-b');
  const revokedPrivate = await unwrapStaffPrivateKey(revokedKeys.wrappedPrivateKey, vault.dataKey, 'admin-a');
  const remainingPrivate = await unwrapStaffPrivateKey(remainingKeys.wrappedPrivateKey, vault.dataKey, 'admin-b');
  const oldRevokedEnvelope = await createStaffGoalKeyEnvelope(oldKey, revokedKeys.publicKey, goalId, 'admin-a', 1);
  const oldRevokedKey = await openStaffGoalKeyEnvelope(oldRevokedEnvelope, revokedPrivate, goalId, 'admin-a');
  const records = Object.fromEntries(Object.keys(MIGRATION_COLLECTIONS).map(name => [name, []])) as GoalRotationSnapshot['records'];
  const snapshot: GoalRotationSnapshot = { rotationId: 'rotation-1', targetGrantId: 'grant-a', previousGoalKeyVersion: 1, goal: { id: goalId, userId: ownerId, encryptedPayload: oldGoal, ownerWrappedGoalKey: ownerEnvelope }, records, remainingGrants: [{ grantId: 'grant-b', granteeUserId: 'admin-b', publicKey: JSON.stringify(remainingKeys.publicKey), staffKeyVersion: 1 }] };

  const payload: any = await buildGoalKeyRotation(snapshot, vault.dataKey, ownerId);
  assert.equal(payload.goalKeyVersion, 2);
  assert.equal(payload.remainingGrantEnvelopes.length, 1);
  assert.equal(payload.remainingGrantEnvelopes[0].granteeUserId, 'admin-b');
  assert.equal(JSON.stringify(payload).includes(secret), false);

  await assert.rejects(() => decryptContent(oldRevokedKey, payload.goalEncryptedPayload, { userId: ownerId, entityType: 'goal', entityId: goalId }));
  const ownerNewKey = await unwrapGoalKeyForOwner(payload.ownerWrappedGoalKey, vault.dataKey, ownerId, goalId);
  assert.equal((await decryptContent<any>(ownerNewKey, payload.goalEncryptedPayload, { userId: ownerId, entityType: 'goal', entityId: goalId })).title, secret);
  const staffEnvelope = JSON.parse(payload.remainingGrantEnvelopes[0].encryptedKeyEnvelope) as StaffGoalKeyEnvelope;
  const remainingNewKey = await openStaffGoalKeyEnvelope(staffEnvelope, remainingPrivate, goalId, 'admin-b');
  assert.equal((await decryptContent<any>(remainingNewKey, payload.goalEncryptedPayload, { userId: ownerId, entityType: 'goal', entityId: goalId })).title, secret);
  await assert.rejects(() => openStaffGoalKeyEnvelope(staffEnvelope, revokedPrivate, goalId, 'admin-a'));

  const resumed: any = await buildGoalKeyRotation(snapshot, vault.dataKey, ownerId);
  assert.equal(resumed.goalKeyVersion, 2);
  assert.equal((await decryptContent<any>(await unwrapGoalKeyForOwner(resumed.ownerWrappedGoalKey, vault.dataKey, ownerId, goalId), resumed.goalEncryptedPayload, { userId: ownerId, entityType: 'goal', entityId: goalId })).title, secret);
});
