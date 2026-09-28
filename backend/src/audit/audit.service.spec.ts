import { auditEntryHash, legacyCheckpointAnchor, legacyDatasetDigest } from './audit-chain';

const legacy = () => [{ id: 'legacy-1', action: 'LOGIN', createdAt: new Date('2026-01-01T00:00:00Z') }, { id: 'legacy-2', action: 'LOGOUT', createdAt: new Date('2026-01-02T00:00:00Z') }] as any[];
const checkpointFor = (records: any[]) => ({ id: 'checkpoint-1', legacyRecordCount: records.length, lastLegacyAuditId: records.at(-1)?.id, legacyDigest: legacyDatasetDigest(records), version: 1, algorithm: 'SHA-256' });
const checkpointValid = (records: any[], checkpoint: any) => checkpoint.legacyRecordCount === records.length && checkpoint.lastLegacyAuditId === records.at(-1)?.id && checkpoint.legacyDigest === legacyDatasetDigest(records);

test('valid audit hash chain verifies', () => {
  const entry: any = { id: '1', action: 'LOGIN', createdAt: new Date('2026-01-01T00:00:00Z') };
  entry.previousHash = 'GENESIS'; entry.entryHash = auditEntryHash(entry.previousHash, entry);
  expect(entry.entryHash).toBe(auditEntryHash('GENESIS', entry));
});
test('modified audit record changes its expected hash', () => {
  const entry: any = { id: '1', action: 'LOGIN', createdAt: new Date('2026-01-01T00:00:00Z') };
  entry.previousHash = 'GENESIS'; entry.entryHash = auditEntryHash(entry.previousHash, entry); entry.action = 'DELETED';
  expect(entry.entryHash).not.toBe(auditEntryHash('GENESIS', entry));
});
test('v2 immutable actor snapshot survives nullable lookup removal', () => {
  const entry: any = { id: '2', hashVersion: 2, actorId: 'deleted-user-id', actorUserId: 'deleted-user-id', action: 'ACCOUNT_DELETED', createdAt: new Date('2026-01-03T00:00:00Z') };
  entry.previousHash = 'GENESIS'; entry.entryHash = auditEntryHash(entry.previousHash, entry);
  entry.actorUserId = null;
  expect(entry.entryHash).toBe(auditEntryHash(entry.previousHash, entry));
});
test('v2 immutable actor snapshot tampering is detected', () => {
  const entry: any = { id: '3', hashVersion: 2, actorId: 'actor-a', actorUserId: 'actor-a', action: 'LOGIN', createdAt: new Date('2026-01-03T00:00:00Z') };
  entry.previousHash = 'GENESIS'; entry.entryHash = auditEntryHash(entry.previousHash, entry);
  entry.actorId = 'actor-b';
  expect(entry.entryHash).not.toBe(auditEntryHash(entry.previousHash, entry));
});
test('valid legacy checkpoint passes', () => { const records = legacy(); expect(checkpointValid(records, checkpointFor(records))).toBe(true); });
test('modified legacy record fails checkpoint verification', () => { const records = legacy(), checkpoint = checkpointFor(records); records[0].action = 'MODIFIED'; expect(checkpointValid(records, checkpoint)).toBe(false); });
test('deleted or reordered legacy record fails checkpoint verification', () => { const records = legacy(), checkpoint = checkpointFor(records); expect(checkpointValid([records[1]], checkpoint)).toBe(false); expect(checkpointValid([records[1], records[0]], checkpoint)).toBe(false); });
test('post-cutover tampering fails and new entries chain from the checkpoint', () => {
  const records = legacy(), checkpoint = checkpointFor(records), entry: any = { id: 'post-1', action: 'GOAL_CREATED', createdAt: new Date('2026-01-03T00:00:00Z') };
  entry.previousHash = legacyCheckpointAnchor(checkpoint); entry.entryHash = auditEntryHash(entry.previousHash, entry);
  expect(entry.entryHash).toBe(auditEntryHash(legacyCheckpointAnchor(checkpoint), entry));
  entry.action = 'TAMPERED'; expect(entry.entryHash).not.toBe(auditEntryHash(entry.previousHash, entry));
});
