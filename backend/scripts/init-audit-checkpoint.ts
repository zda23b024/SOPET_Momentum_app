import { PrismaClient } from '@prisma/client';
import { AuditCheckpointService } from '../src/audit/audit-checkpoint.service';
async function main() {
  const force = process.argv.includes('--force'); const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const checkpoint = await new AuditCheckpointService(prisma as any).initialize(force);
    console.log(`PASS LEGACY CHECKPOINT CREATED id=${checkpoint.id} legacyRecords=${checkpoint.legacyRecordCount} cutover=${checkpoint.cutoverTimestamp.toISOString()} algorithm=${checkpoint.algorithm}/v${checkpoint.version}`);
  } finally { await prisma.$disconnect(); }
}
main().catch(err => { console.error(`FAIL ${err.message}`); process.exitCode = 1; });
