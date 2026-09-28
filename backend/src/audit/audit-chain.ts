import { createHash } from 'crypto';

/** Stable, allow-listed representation: audit chains never contain private content. */
export const AUDIT_HASH_VERSION = 2;

export function canonicalAuditData(entry: Record<string, unknown>) {
  const hashVersion = Number(entry.hashVersion || 1);
  const data = {
    ...(hashVersion >= AUDIT_HASH_VERSION ? { hashVersion } : {}),
    id: entry.id, actorId: entry.actorId ?? null, action: entry.action,
    targetId: entry.targetId ?? null, targetType: entry.targetType ?? null,
    detailsJson: entry.detailsJson ?? null, ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null, result: entry.result ?? 'SUCCESS',
    reason: entry.reason ?? null,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
  };
  return JSON.stringify(data);
}
export function auditEntryHash(previousHash: string, entry: Record<string, unknown>) {
  return createHash('sha256').update(previousHash + canonicalAuditData(entry), 'utf8').digest('hex');
}

export const LEGACY_CHECKPOINT_ALGORITHM = 'SHA-256';
export const LEGACY_CHECKPOINT_VERSION = 1;
export function legacyDatasetDigest(entries: Array<Record<string, unknown>>) {
  // Newline avoids ambiguous concatenation while preserving the database order.
  return createHash('sha256').update(entries.map(canonicalAuditData).join('\n'), 'utf8').digest('hex');
}
export function legacyCheckpointAnchor(checkpoint: { id: string; legacyDigest: string; version: number }) {
  return `LEGACY_CHECKPOINT:v${checkpoint.version}:${checkpoint.id}:${checkpoint.legacyDigest}`;
}
