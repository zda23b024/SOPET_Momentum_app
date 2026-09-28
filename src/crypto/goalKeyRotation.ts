import { MIGRATION_COLLECTIONS } from './legacyGoalMigration';
import { createStaffGoalKeyEnvelope, generateGoalKey, unwrapGoalKeyForOwner, wrapGoalKeyForOwner } from './goalKeys';
import { decryptContent, encryptContent } from './vault';
import type { EncryptedContentEnvelope } from './privacyTypes';

type RecordItem = { id: string; encryptedPayload: EncryptedContentEnvelope };
export interface GoalRotationSnapshot {
  rotationId: string;
  targetGrantId: string;
  previousGoalKeyVersion: number;
  goal: RecordItem & { userId: string; ownerWrappedGoalKey: EncryptedContentEnvelope };
  records: Record<keyof typeof MIGRATION_COLLECTIONS, RecordItem[]>;
  remainingGrants: Array<{ grantId: string; granteeUserId: string; publicKey: string; staffKeyVersion: number }>;
}

export async function buildGoalKeyRotation(snapshot: GoalRotationSnapshot, vaultKey: CryptoKey, ownerUserId: string) {
  if (snapshot.goal.userId !== ownerUserId) throw new Error('GOAL_OWNER_MISMATCH');
  const oldKey = await unwrapGoalKeyForOwner(snapshot.goal.ownerWrappedGoalKey, vaultKey, ownerUserId, snapshot.goal.id);
  const newKey = await generateGoalKey();
  const nextVersion = snapshot.previousGoalKeyVersion + 1;
  const goalPlaintext = await decryptContent<Record<string, unknown>>(oldKey, snapshot.goal.encryptedPayload, { userId: ownerUserId, entityType: 'goal', entityId: snapshot.goal.id });
  const payload: Record<string, unknown> = {
    rotationId: snapshot.rotationId,
    previousGoalKeyVersion: snapshot.previousGoalKeyVersion,
    goalKeyVersion: nextVersion,
    goalEncryptedPayload: await encryptContent(newKey, goalPlaintext, { userId: ownerUserId, entityType: 'goal', entityId: snapshot.goal.id, keyVersion: nextVersion }),
    ownerWrappedGoalKey: await wrapGoalKeyForOwner(newKey, vaultKey, ownerUserId, snapshot.goal.id, nextVersion),
  };
  for (const [name, config] of Object.entries(MIGRATION_COLLECTIONS) as Array<[keyof typeof MIGRATION_COLLECTIONS, typeof MIGRATION_COLLECTIONS[keyof typeof MIGRATION_COLLECTIONS]]>) {
    payload[name] = await Promise.all(snapshot.records[name].map(async record => {
      const plaintext = await decryptContent<Record<string, unknown>>(oldKey, record.encryptedPayload, { userId: ownerUserId, entityType: config.entityType, entityId: record.id });
      return { id: record.id, encryptedPayload: await encryptContent(newKey, plaintext, { userId: ownerUserId, entityType: config.entityType, entityId: record.id, keyVersion: nextVersion }) };
    }));
  }
  payload.remainingGrantEnvelopes = await Promise.all(snapshot.remainingGrants.map(async grant => {
    const envelope = await createStaffGoalKeyEnvelope(newKey, JSON.parse(grant.publicKey) as JsonWebKey, snapshot.goal.id, grant.granteeUserId, nextVersion);
    return { grantId: grant.grantId, granteeUserId: grant.granteeUserId, encryptedKeyEnvelope: JSON.stringify(envelope), encryptionMetadata: { algorithm: envelope.algorithm, keyVersion: nextVersion, staffKeyVersion: grant.staffKeyVersion } };
  }));
  return payload;
}
