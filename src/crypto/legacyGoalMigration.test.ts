import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoalKeyMigration, MIGRATION_COLLECTIONS, migrateLegacyGoals, type GoalMigrationApi, type LegacyGoalMigrationSnapshot } from './legacyGoalMigration';
import { createVault, decryptContent, encryptContent } from './vault';
import { unwrapGoalKeyForOwner } from './goalKeys';

const emptyRecords = () => Object.fromEntries(Object.keys(MIGRATION_COLLECTIONS).map(name => [name, []])) as LegacyGoalMigrationSnapshot['records'];

async function snapshot(vaultKey: CryptoKey): Promise<LegacyGoalMigrationSnapshot> {
  return {
    skipped: false,
    migrationId: 'migration-1',
    goal: {
      id: 'goal-legacy', userId: 'user-1', privacyMode: 'HIGHLY_CONFIDENTIAL',
      encryptedPayload: await encryptContent(vaultKey, { title: 'Legacy secret', description: 'Protected detail', whyItMatters: 'Private reason' }, { userId: 'user-1', entityType: 'goal', entityId: 'goal-legacy', keyVersion: 1 }),
    },
    records: { ...emptyRecords(), actions: [{ id: 'action-1', goalId: 'goal-legacy', title: 'Legacy child secret' }] },
  };
}

test('successfully migrates legacy ciphertext to a new per-goal GDEK', async () => {
  const vault = await createVault('migration passphrase 123');
  const input = await snapshot(vault.dataKey);
  const payload = await buildGoalKeyMigration(input, vault.dataKey, 'user-1') as any;
  const goalKey = await unwrapGoalKeyForOwner(payload.ownerWrappedGoalKey, vault.dataKey, 'user-1', 'goal-legacy');
  const restored = await decryptContent<{ title: string }>(goalKey, payload.goalEncryptedPayload, { userId: 'user-1', entityType: 'goal', entityId: 'goal-legacy' });
  const child = await decryptContent<{ title: string }>(goalKey, payload.actions[0].encryptedPayload, { userId: 'user-1', entityType: 'action', entityId: 'action-1' });
  assert.equal(restored.title, 'Legacy secret');
  assert.equal(child.title, 'Legacy child secret');
});

test('interrupted migration can resume and commit idempotently', async () => {
  const vault = await createVault('migration passphrase 123');
  const migrationSnapshot = await snapshot(vault.dataKey);
  let attempt = 0;
  let failed = false;
  const api: GoalMigrationApi = {
    candidates: async () => [{ id: 'goal-legacy', privacyMode: 'HIGHLY_CONFIDENTIAL', privacyMigrationStatus: failed ? 'FAILED' : 'IN_PROGRESS' }],
    begin: async () => migrationSnapshot,
    commit: async () => { attempt += 1; if (attempt === 1) throw new Error('NETWORK_INTERRUPTED'); return { skipped: false, status: 'COMPLETED' }; },
    fail: async () => { failed = true; },
  };
  const first = await migrateLegacyGoals(api, vault.dataKey, 'user-1');
  const resumed = await migrateLegacyGoals(api, vault.dataKey, 'user-1');
  assert.deepEqual(first.failed, ['goal-legacy']);
  assert.deepEqual(resumed.migrated, ['goal-legacy']);
});

test('wrong vault key cannot migrate legacy content', async () => {
  const correct = await createVault('correct passphrase 123');
  const wrong = await createVault('different passphrase 123');
  const input = await snapshot(correct.dataKey);
  await assert.rejects(() => buildGoalKeyMigration(input, wrong.dataKey, 'user-1'));
});

test('tampered legacy ciphertext is rejected', async () => {
  const vault = await createVault('migration passphrase 123');
  const input = await snapshot(vault.dataKey);
  input.goal!.encryptedPayload = { ...input.goal!.encryptedPayload!, ciphertext: `${input.goal!.encryptedPayload!.ciphertext.slice(0, -2)}aa` };
  await assert.rejects(() => buildGoalKeyMigration(input, vault.dataKey, 'user-1'));
});

test('commit payload contains no legacy plaintext', async () => {
  const vault = await createVault('migration passphrase 123');
  const payload = await buildGoalKeyMigration(await snapshot(vault.dataKey), vault.dataKey, 'user-1');
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('Legacy secret'), false);
  assert.equal(serialized.includes('Legacy child secret'), false);
  assert.equal(serialized.includes('Protected detail'), false);
  assert.equal(serialized.includes('Private reason'), false);
});

test('already-migrated goal is skipped without beginning a migration', async () => {
  let began = false;
  const api: GoalMigrationApi = {
    candidates: async () => [{ id: 'goal-new', privacyMode: 'ENCRYPTED_PRIVATE', ownerWrappedGoalKey: {}, goalKeyVersion: 1, privacyMigrationStatus: 'COMPLETED' }],
    begin: async () => { began = true; throw new Error('SHOULD_NOT_BEGIN'); },
    commit: async () => ({ skipped: false, status: 'COMPLETED' }),
    fail: async () => undefined,
  };
  const vault = await createVault('migration passphrase 123');
  const result = await migrateLegacyGoals(api, vault.dataKey, 'user-1');
  assert.equal(began, false);
  assert.deepEqual(result.skipped, ['goal-new']);
});
