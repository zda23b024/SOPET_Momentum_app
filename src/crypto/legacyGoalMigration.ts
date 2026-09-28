import type { EncryptedContentEnvelope } from './privacyTypes';
import { decryptContent, encryptContent } from './vault';
import { generateGoalKey, unwrapGoalKeyForOwner, wrapGoalKeyForOwner } from './goalKeys';

export const MIGRATION_COLLECTIONS = {
  milestones: { entityType: 'milestone', fields: ['title', 'description'] },
  actions: { entityType: 'action', fields: ['title', 'description'] },
  nmaRecords: { entityType: 'nma', fields: ['rationale'] },
  readinessAssessments: { entityType: 'readiness', fields: ['notes'] },
  barriers: { entityType: 'barrier', fields: ['userExplanation'] },
  actionInterventions: { entityType: 'intervention', fields: ['outcomeNotes'] },
  mmas: { entityType: 'mma', fields: ['title', 'whyThisHelps'] },
  interruptions: { entityType: 'restart', fields: ['causeDescription'] },
  restarts: { entityType: 'restart', fields: ['whatChanged', 'rootCause', 'restartActionTitle'] },
  kpis: { entityType: 'kpi', fields: ['name', 'unit'] },
  kpiValues: { entityType: 'kpi-value', fields: ['notes'] },
  weeklyReviews: { entityType: 'review', fields: ['meaningfulProgress', 'actionsThatMattered', 'whatGotInTheWay', 'interventionsThatHelped', 'interventionsThatDidNotHelp', 'restartDetails', 'nextNmaTitle', 'aiSummaryDraft'] },
  lessons: { entityType: 'lesson', fields: ['lessonText', 'adjustmentText'] },
  adjustments: { entityType: 'adjustment', fields: ['description'] },
} as const;

type CollectionName = keyof typeof MIGRATION_COLLECTIONS;
type LegacyRecord = Record<string, any> & { id: string; encryptedPayload?: EncryptedContentEnvelope; plaintextContent?: Record<string, unknown> };

export interface LegacyGoalMigrationSnapshot {
  skipped: boolean;
  reason?: string;
  migrationId?: string;
  goal?: LegacyRecord & { id: string; userId: string; privacyMode: string; ownerWrappedGoalKey?: EncryptedContentEnvelope; goalKeyVersion?: number };
  records?: Record<CollectionName, LegacyRecord[]>;
}

export interface GoalMigrationApi {
  candidates(): Promise<Array<{ id: string; privacyMode: string; ownerWrappedGoalKey?: unknown; goalKeyVersion?: number; privacyMigrationStatus: string }>>;
  begin(goalId: string): Promise<LegacyGoalMigrationSnapshot>;
  commit(goalId: string, payload: Record<string, unknown>): Promise<{ skipped: boolean; status: string }>;
  fail(goalId: string, migrationId: string, errorCode: string): Promise<unknown>;
}

const pickPrivate = (record: LegacyRecord, fields: readonly string[]) => {
  const content: Record<string, unknown> = { ...(record.plaintextContent || {}) };
  fields.forEach(field => { if (record[field] !== undefined && record[field] !== null) content[field] = record[field]; });
  delete content.schemaVersion;
  return content;
};

async function decryptLegacyRecord(vaultKey: CryptoKey, userId: string, record: LegacyRecord, entityType: string, fields: readonly string[], contextIds: string[]) {
  if (!record.encryptedPayload && (record.ciphertextPayload || record.isClientEncrypted)) throw new Error('UNSUPPORTED_LEGACY_CIPHERTEXT_FORMAT');
  if (!record.encryptedPayload) return pickPrivate(record, fields);
  let lastError: unknown;
  for (const entityId of [...new Set(contextIds.filter(Boolean))]) {
    try {
      const value = await decryptContent<Record<string, unknown>>(vaultKey, record.encryptedPayload, { userId, entityType, entityId });
      delete value.schemaVersion;
      return value;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('DECRYPTION_FAILED');
}

const contextCandidates = (record: LegacyRecord, goalId: string) => [record.id, record.actionId, record.parentActionId, record.interruptionId, record.kpiId, record.weeklyReviewId, goalId].filter(Boolean);

export async function buildGoalKeyMigration(snapshot: LegacyGoalMigrationSnapshot, vaultKey: CryptoKey, userId: string) {
  if (snapshot.skipped) return null;
  if (!snapshot.goal || !snapshot.records || !snapshot.migrationId) throw new Error('INVALID_MIGRATION_SNAPSHOT');
  if (snapshot.goal.privacyMode === 'STANDARD_PRIVATE') throw new Error('STANDARD_PRIVATE_NOT_MIGRATABLE');
  const goalId = snapshot.goal.id;
  const legacyContentKey = snapshot.goal.ownerWrappedGoalKey
    ? await unwrapGoalKeyForOwner(snapshot.goal.ownerWrappedGoalKey, vaultKey, userId, goalId)
    : vaultKey;
  const legacyGoal = await decryptLegacyRecord(legacyContentKey, userId, snapshot.goal, 'goal', ['title', 'description', 'whyItMatters'], [goalId]);
  const goalKey = await generateGoalKey();
  const goalEncryptedPayload = await encryptContent(goalKey, legacyGoal, { userId, entityType: 'goal', entityId: goalId, keyVersion: 1 });
  const ownerWrappedGoalKey = await wrapGoalKeyForOwner(goalKey, vaultKey, userId, goalId, 1);
  const result: Record<string, unknown> = { migrationId: snapshot.migrationId, goalKeyVersion: 1, ownerWrappedGoalKey, goalEncryptedPayload };

  for (const [name, config] of Object.entries(MIGRATION_COLLECTIONS) as Array<[CollectionName, typeof MIGRATION_COLLECTIONS[CollectionName]]>) {
    result[name] = await Promise.all(snapshot.records[name].map(async record => {
      const privateContent = await decryptLegacyRecord(legacyContentKey, userId, record, config.entityType, config.fields, contextCandidates(record, goalId));
      return { id: record.id, encryptedPayload: await encryptContent(goalKey, privateContent, { userId, entityType: config.entityType, entityId: record.id, keyVersion: 1 }) };
    }));
  }
  return result;
}

export async function migrateLegacyGoals(api: GoalMigrationApi, vaultKey: CryptoKey, userId: string) {
  const candidates = await api.candidates();
  const summary = { migrated: [] as string[], skipped: [] as string[], failed: [] as string[] };
  for (const candidate of candidates) {
    if (candidate.privacyMode === 'STANDARD_PRIVATE' || (candidate.ownerWrappedGoalKey && (candidate.goalKeyVersion ?? 0) > 0 && candidate.privacyMigrationStatus === 'COMPLETED')) { summary.skipped.push(candidate.id); continue; }
    const snapshot = await api.begin(candidate.id);
    if (snapshot.skipped) { summary.skipped.push(candidate.id); continue; }
    try {
      const payload = await buildGoalKeyMigration(snapshot, vaultKey, userId);
      if (!payload) { summary.skipped.push(candidate.id); continue; }
      const committed = await api.commit(candidate.id, payload);
      (committed.skipped ? summary.skipped : summary.migrated).push(candidate.id);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MIGRATION_FAILED';
      await api.fail(candidate.id, snapshot.migrationId!, code).catch(() => undefined);
      summary.failed.push(candidate.id);
    }
  }
  return summary;
}
