import { PrismaClient } from '@prisma/client';
import { validateProductionEnvironment } from '../src/config/configuration';

async function main() {
  if (process.env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production');
  validateProductionEnvironment();
  const prisma = new PrismaClient();
  try { await prisma.$queryRaw`SELECT 1`; console.log('PASS database reachable'); }
  finally { await prisma.$disconnect(); }
  console.log('PASS production configuration validated (secrets redacted)');
}
main().catch(err => { console.error(`FAIL ${err.message}`); process.exitCode = 1; });
