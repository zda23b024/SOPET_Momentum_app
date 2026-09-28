import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect(); (prisma as any).isConnected = true;
    const result = await new AuditService(prisma as any).verifyChain();
    if (!result.valid) throw new Error(`${result.message}${result.brokenAt ? ` (${result.brokenAt})` : ''}`);
    console.log(`PASS ${result.message}; ${result.checked} chained entries checked`);
  } finally { await prisma.$disconnect(); }
}
main().catch(err => { console.error(`FAIL ${err.message}`); process.exitCode = 1; });
