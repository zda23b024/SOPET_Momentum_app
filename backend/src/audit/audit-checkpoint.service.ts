import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LEGACY_CHECKPOINT_ALGORITHM, LEGACY_CHECKPOINT_VERSION, legacyDatasetDigest } from './audit-chain';

@Injectable()
export class AuditCheckpointService {
  constructor(private readonly prisma: PrismaService) {}
  async initialize(force = false) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(87420931)');
      const checkpoints = await (tx as any).auditCheckpoint.findMany({ orderBy: { createdAt: 'asc' } });
      const all = await tx.auditLog.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (all.some((entry: any) => entry.entryHash || entry.previousHash)) throw new ConflictException('Cannot initialize checkpoint after chained entries exist.');
      if (checkpoints.length && !force) throw new ConflictException('Legacy audit checkpoint already exists; rerun only with --force after an explicit review.');
      const data = { cutoverTimestamp: new Date(), legacyRecordCount: all.length, lastLegacyAuditId: all.at(-1)?.id, legacyDigest: legacyDatasetDigest(all), algorithm: LEGACY_CHECKPOINT_ALGORITHM, version: LEGACY_CHECKPOINT_VERSION };
      // Explicit force is allowed only before any chained entry exists. Legacy AuditLog rows remain untouched.
      const checkpoint = checkpoints.length ? await (tx as any).auditCheckpoint.update({ where: { id: checkpoints[0].id }, data }) : await (tx as any).auditCheckpoint.create({ data });
      return checkpoint;
    });
  }
}
