import 'dotenv/config';
import { PrismaClient, UserRoleType } from '@prisma/client';
import { CryptoUtil } from '../src/common/utils/crypto.util';

export function validateBootstrapConfig(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV === 'production') throw new Error('Admin bootstrap is forbidden in production');
  if (environment.BOOTSTRAP_ADMIN_ENABLED !== 'true') throw new Error('Set BOOTSTRAP_ADMIN_ENABLED=true explicitly for local/staging bootstrap');
  const email = environment.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD;
  const role = (environment.BOOTSTRAP_ADMIN_ROLE === 'SYSTEM_OWNER' ? UserRoleType.OWNER : environment.BOOTSTRAP_ADMIN_ROLE) || UserRoleType.OWNER;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid BOOTSTRAP_ADMIN_EMAIL is required');
  if (!password || password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
  if (role !== UserRoleType.OWNER) throw new Error('Bootstrap supports OWNER only');
  return { email, password, role };
}

export async function bootstrapAdmin(client: PrismaClient, environment: NodeJS.ProcessEnv) {
  const { email, password, role } = validateBootstrapConfig(environment);
  const existing = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return 'EXISTS_UNCHANGED';
  const ownerRole = await client.role.findUnique({ where: { name: role }, select: { id: true } });
  if (!ownerRole) throw new Error('Seed roles and permissions before bootstrapping an admin');
  const bootstrapPermissions = [
    ['admin.dashboard.view', 'Open the administration workspace'],
    ['admin.users.view', 'View safe user account metadata'],
    ['admin.users.manage', 'Activate and deactivate permitted accounts'],
    ['admin.audit.view', 'View administrative audit history'],
    ['admin.deletions.view', 'View scheduled account deletions'],
    ['admin.health.view', 'View system health summary'],
  ];
  for (const [code, description] of bootstrapPermissions) {
    const permission = await client.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
    await client.rolePermission.upsert({ where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id } }, update: {}, create: { roleId: ownerRole.id, permissionId: permission.id } });
  }
  const passwordHash = await CryptoUtil.hashPassword(password);
  try {
    await client.user.create({ data: {
      email, passwordHash, fullName: 'System Owner', isEmailVerified: true, mfaRecoveryCodes: [],
      profile: { create: {} }, userRoles: { create: { roleId: ownerRole.id } },
    } });
  } catch (error: any) {
    if (error.code === 'P2002') return 'EXISTS_UNCHANGED';
    throw error;
  }
  return 'CREATED';
}

if (require.main === module) {
  const client = new PrismaClient();
  bootstrapAdmin(client, process.env)
    .then(result => console.log(`Admin bootstrap ${result === 'CREATED' ? 'completed' : 'skipped: account already exists'}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}
