import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { auditEntryHash, legacyCheckpointAnchor, legacyDatasetDigest, LEGACY_CHECKPOINT_ALGORITHM, LEGACY_CHECKPOINT_VERSION } from './audit-chain';

export interface CreateAuditLogParams {
  actorId?: string;
  actorUserId?: string | null;
  actorEmail?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  result?: 'SUCCESS' | 'FAILURE';
  reason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');
  private readonly memoryAuditLogs: any[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    const sanitizedDetails = params.details ? CryptoUtil.sanitizeForLogs(params.details) : undefined;
    const detailsJson = sanitizedDetails ? JSON.stringify(sanitizedDetails) : undefined;

    const logEntry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      actorId: params.actorId,
      actorUserId: params.actorUserId === undefined ? params.actorId : params.actorUserId,
      actorEmail: params.actorEmail,
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      detailsJson,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      result: params.result || 'SUCCESS',
      reason: params.reason,
      createdAt: new Date(),
      hashVersion: 2,
    };

    this.logger.log(`AUDIT [${logEntry.action}] by ${logEntry.actorEmail || logEntry.actorId || 'SYSTEM'} - Result: ${logEntry.result}`);

    if (this.prisma.isConnected) {
      try {
        await this.prisma.$transaction(async tx => {
          // Serialize append operations; a chain must not fork under concurrent requests.
          await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(87420931)');
          const previous = await tx.auditLog.findFirst({ where: { entryHash: { not: null } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { entryHash: true } });
          const checkpoint = previous ? null : await (tx as any).auditCheckpoint.findFirst({ orderBy: { createdAt: 'desc' } });
          const previousHash = previous?.entryHash || (checkpoint ? legacyCheckpointAnchor(checkpoint) : 'GENESIS');
          const entryHash = auditEntryHash(previousHash, logEntry);
          // Cast bridges the generated client during the migration deploy window; Prisma is regenerated in CI/deployment.
          await (tx.auditLog as any).create({ data: { ...logEntry, previousHash, entryHash, legacyCheckpointId: checkpoint?.id } });
        });
        return;
      } catch (e: any) {
        this.logger.warn(`Failed to persist audit log to DB: ${e.message}`);
        if (process.env.NODE_ENV === 'production') throw e;
      }
    }
    this.memoryAuditLogs.unshift(logEntry);
  }

  async getRecentLogs(limit = 50) {
    if (this.prisma.isConnected) {
      try {
        return await this.prisma.auditLog.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        // fallback
      }
    }
    return this.memoryAuditLogs.slice(0, limit);
  }

  async verifyChain(): Promise<{ valid: boolean; checked: number; legacyCheckpoint?: 'VALID' | 'MISSING' | 'INVALID'; brokenAt?: string; message: string }> {
    if (!this.prisma.isConnected) return { valid: false, checked: 0, brokenAt: 'DATABASE_UNAVAILABLE', message: 'DATABASE UNAVAILABLE' };
    const entries = await this.prisma.auditLog.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const legacy = entries.filter((entry: any) => !entry.entryHash && !entry.previousHash);
    const chained = entries.filter((entry: any) => entry.entryHash || entry.previousHash);
    const checkpoint = await (this.prisma as any).auditCheckpoint.findFirst({ orderBy: { createdAt: 'asc' } });
    if (legacy.length && !checkpoint) return { valid: false, checked: 0, legacyCheckpoint: 'MISSING', brokenAt: legacy[0].id, message: 'LEGACY CHECKPOINT MISSING' };
    let previousHash = 'GENESIS';
    if (checkpoint) {
      if (checkpoint.algorithm !== LEGACY_CHECKPOINT_ALGORITHM || checkpoint.version !== LEGACY_CHECKPOINT_VERSION || checkpoint.legacyRecordCount !== legacy.length || checkpoint.lastLegacyAuditId !== legacy.at(-1)?.id || checkpoint.legacyDigest !== legacyDatasetDigest(legacy)) return { valid: false, checked: 0, legacyCheckpoint: 'INVALID', brokenAt: checkpoint.id, message: 'LEGACY CHECKPOINT INVALID' };
      previousHash = legacyCheckpointAnchor(checkpoint);
    }
    for (let i = 0; i < chained.length; i++) {
      const entry = chained[i] as any;
      if (entry.previousHash !== previousHash || entry.entryHash !== auditEntryHash(previousHash, entry)) return { valid: false, checked: i, legacyCheckpoint: checkpoint ? 'VALID' : undefined, brokenAt: entry.id, message: `CHAIN INVALID at ${entry.id}` };
      previousHash = entry.entryHash;
    }
    return { valid: true, checked: chained.length, legacyCheckpoint: checkpoint ? 'VALID' : undefined, message: `${checkpoint ? 'LEGACY CHECKPOINT VALID; ' : ''}CHAIN VALID` };
  }
}
