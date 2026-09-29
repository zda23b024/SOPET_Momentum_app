import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CryptoUtil } from '../common/utils/crypto.util';

describe('MFA management', () => {
  const createService = async () => {
    const user = {
      passwordHash: await CryptoUtil.hashPassword('CurrentPassword123!'),
      mfaEnabled: true,
      mfaSecret: CryptoUtil.generateTotpSecret(),
      mfaRecoveryCodes: [CryptoUtil.hashToken('unused-recovery-code')],
    };
    const prisma: any = {
      isConnected: true,
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn(async ({ data }: any) => Object.assign(user, data)),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.mfaEnabled !== user.mfaEnabled) return { count: 0 };
          Object.assign(user, data);
          return { count: 1 };
        }),
      },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma.$transaction = jest.fn(async (work: (client: typeof prisma) => Promise<void>) => work(prisma));
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { user, prisma, audit, service: new AuthService(prisma, {} as any, {} as any, audit as any, {} as any, {} as any) };
  };

  it('generates a 160-bit unpadded Base32 secret and verifies the RFC 6238 SHA1 vector', () => {
    const secret = CryptoUtil.generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(CryptoUtil.verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59000)).toBe(true);
    expect(CryptoUtil.verifyTotp('not-base32!', '287082', 59000)).toBe(false);
  });

  it('replaces an unconfirmed enrollment secret and returns a standard authenticator URI', async () => {
    const { service, user, prisma } = await createService();
    user.mfaEnabled = false;
    user.mfaSecret = 'OLDUNCONFIRMEDSECRET';
    (user as typeof user & { email?: string }).email = 'owner@example.test';
    prisma.user.findUnique.mockResolvedValueOnce({ mfaEnabled: false, email: 'owner@example.test' });
    const enrollment = await service.beginMfaEnrollment('owner');
    expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(enrollment.secret).not.toBe('OLDUNCONFIRMEDSECRET');
    expect(user.mfaSecret).toBe(enrollment.secret);
    expect(enrollment.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const uri = new URL(enrollment.otpauthUri);
    expect(decodeURIComponent(uri.pathname.slice(1))).toBe('SOPET Momentum:owner@example.test');
    expect(uri.searchParams.get('secret')).toBe(enrollment.secret);
    expect(uri.searchParams.get('issuer')).toBe('SOPET Momentum');
    expect(uri.searchParams.get('algorithm')).toBe('SHA1');
    expect(uri.searchParams.get('digits')).toBe('6');
    expect(uri.searchParams.get('period')).toBe('30');
  });

  it('does not allow enrollment to disable existing MFA', async () => {
    const { service, prisma } = await createService();
    await expect(service.beginMfaEnrollment('owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite MFA if the account changes during enrollment', async () => {
    const { service, user, prisma } = await createService();
    prisma.user.findUnique.mockResolvedValueOnce({ mfaEnabled: false });
    await expect(service.beginMfaEnrollment('owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(user.mfaEnabled).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalled();
  });

  it('requires current password and a second factor', async () => {
    const { service, prisma } = await createService();
    await expect(service.disableMfa('owner', { currentPassword: 'wrong', recoveryCode: 'unused-recovery-code' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.regenerateMfaRecoveryCodes('owner', { currentPassword: 'CurrentPassword123!' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('replaces hashed recovery codes after password and MFA verification', async () => {
    const { service, user } = await createService();
    const result = await service.regenerateMfaRecoveryCodes('owner', { currentPassword: 'CurrentPassword123!', recoveryCode: 'unused-recovery-code' });
    expect(result.recoveryCodes).toHaveLength(8);
    expect(user.mfaRecoveryCodes).not.toContain(CryptoUtil.hashToken('unused-recovery-code'));
    expect(user.mfaRecoveryCodes).toContain(CryptoUtil.hashToken(result.recoveryCodes[0]));
    expect(user.mfaRecoveryCodes).not.toContain(result.recoveryCodes[0]);
  });

  it('disables MFA and revokes all sessions after password and MFA verification', async () => {
    const { service, user, prisma } = await createService();
    await service.disableMfa('owner', { currentPassword: 'CurrentPassword123!', recoveryCode: 'unused-recovery-code' });
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeNull();
    expect(user.mfaRecoveryCodes).toEqual([]);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'owner', isRevoked: false }, data: { isRevoked: true } });
  });
});
