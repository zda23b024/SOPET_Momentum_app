import { PrismaClient } from '@prisma/client';
import { AuditCheckpointService } from '../src/audit/audit-checkpoint.service';

async function main() {
  if (process.env.AUDIT_REANCHOR_CONFIRMED !== 'true') throw new Error('Set AUDIT_REANCHOR_CONFIRMED=true after approving the historical audit checkpoint procedure.');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const checkpoint = await new AuditCheckpointService(prisma as any).reanchorHistoricalRecords();
    console.log(`PASS AUDIT HISTORY RE-ANCHORED checkpoint=${checkpoint.id} legacyRecords=${checkpoint.legacyRecordCount}`);
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
