import { PrismaClient, UserRoleType } from '@prisma/client';
import { isEmail } from 'class-validator';
import { CryptoUtil } from '../src/common/utils/crypto.util';

class ProvisionError extends Error {}

export async function provisionSystemOwner(db: PrismaClient, env: NodeJS.ProcessEnv = process.env) {
  const email = env.PROVISION_SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  const password = env.PROVISION_SYSTEM_OWNER_PASSWORD;
  if (!email || !password) throw new ProvisionError('Dedicated provisioning email and password are required.');
  if (!isEmail(email)) throw new ProvisionError('A valid provisioning email is required.');
  if (password.length < 16 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)) throw new ProvisionError('Password must be 16–128 characters with uppercase, lowercase, digit, and symbol.');
  return db.$transaction(async tx => {
    // Serialize provisioning and other role assignments on the same database.
    await tx.$executeRawUnsafe('LOCK TABLE "UserRole" IN SHARE ROW EXCLUSIVE MODE');
    const users = await tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    if (users.length > 1) throw new ProvisionError('Ambiguous email identity; provisioning refused.');
    const existing = users[0];
    const owners = await tx.userRole.findMany({ where: { role: { name: UserRoleType.SYSTEM_OWNER } }, select: { userId: true } });
    if (owners.some(owner => owner.userId !== existing?.id)) throw new ProvisionError('A different SYSTEM_OWNER already exists.');
    const role = await tx.role.upsert({ where: { name: UserRoleType.SYSTEM_OWNER }, update: {}, create: { name: UserRoleType.SYSTEM_OWNER, description: 'Platform system owner' } });
    if (existing && owners.length) {
      await tx.user.update({ where: { id: existing.id }, data: { isActive: true, isEmailVerified: true } });
      return 'already-owner';
    }
    const passwordHash = await CryptoUtil.hashPassword(password);
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true, isEmailVerified: true, emailVerificationToken: null, passwordResetToken: null, passwordResetExpiresAt: null }, select: { id: true } })
      : await tx.user.create({ data: { email, passwordHash, isActive: true, isEmailVerified: true, mfaRecoveryCodes: [], profile: { create: {} } }, select: { id: true } });
    if (existing) {
      await tx.session.updateMany({ where: { userId: user.id }, data: { isRevoked: true } });
      await tx.authActionToken.deleteMany({ where: { userId: user.id } });
    }
    await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
    return 'provisioned';
  }, { timeout: 30000 });
}

async function main() {
  const db = new PrismaClient({ log: [] });
  try { console.log(`SYSTEM_OWNER: ${await provisionSystemOwner(db)}`); }
  catch (error) {
    // Raw ORM errors may contain query inputs: never print them or their stacks.
    console.error(error instanceof ProvisionError ? error.message : 'Provisioning failed; transaction rolled back.');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
if (require.main === module) void main();
