import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthActionTokenType } from '@prisma/client';
import { AuthService } from './auth.service';
import { CryptoUtil } from '../common/utils/crypto.util';

function setup() {
  const user: any = { id: 'user-1', email: 'person@example.com', passwordHash: '', fullName: 'Person', isActive: true, isEmailVerified: false, mfaEnabled: false, userRoles: [], defaultPrivacyMode: 'STANDARD_PRIVATE' };
  const tokens: any[] = [];
  const sessions: any[] = [{ id: 'session-old', userId: user.id, isRevoked: false }];
  const sent = { verification: [] as string[], reset: [] as string[], changed: 0 };
  const authActionToken = {
    create: jest.fn(async ({ data }: any) => { const value = { id: `token-${tokens.length + 1}`, usedAt: null, ...data, user }; tokens.push(value); return value; }),
    updateMany: jest.fn(async ({ where, data }: any) => { let count = 0; for (const item of tokens) { if ((!where.id || item.id === where.id) && (!where.userId || item.userId === where.userId) && (!where.type || item.type === where.type) && (where.usedAt !== null || item.usedAt === null) && (!where.expiresAt || item.expiresAt > where.expiresAt.gt)) { Object.assign(item, data); count++; } } return { count }; }),
    findUnique: jest.fn(async ({ where }: any) => tokens.find(item => item.tokenHash === where.tokenHash) ?? null),
  };
  const prisma: any = {
    isConnected: true, authActionToken,
    user: { findUnique: jest.fn(async ({ where }: any) => where.email === user.email || where.id === user.id ? user : null), update: jest.fn(async ({ data }: any) => Object.assign(user, data, data.mfaRecoveryCodes?.set ? { mfaRecoveryCodes: data.mfaRecoveryCodes.set } : {})) },
    session: { updateMany: jest.fn(async ({ data }: any) => { sessions.forEach(item => Object.assign(item, data)); return { count: sessions.length }; }), create: jest.fn(async ({ data }: any) => { sessions.push(data); return data; }) },
    $transaction: jest.fn(async (arg: any) => typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  };
  const attempts = new Map<string, number>();
  const security: any = { isRateLimited: (key: string, limit: number) => (attempts.get(key) ?? 0) >= limit, recordFailedLogin: (key: string) => { const n = (attempts.get(key) ?? 0) + 1; attempts.set(key, n); return n; }, clearFailedLogins: jest.fn(), recordSecurityEvent: jest.fn() };
  const email: any = { sendVerification: jest.fn(async (_email: string, token: string) => sent.verification.push(token)), sendPasswordReset: jest.fn(async (_email: string, token: string) => sent.reset.push(token)), sendPasswordChanged: jest.fn(async () => { sent.changed++; }) };
  const audit: any = { log: jest.fn() };
  const jwt: any = { sign: jest.fn(() => 'signed-token') };
  const config: any = { getOrThrow: jest.fn(() => 'x'.repeat(40)), get: jest.fn((_key: string) => '15m') };
  const service = new AuthService(prisma, jwt, config, audit, security, email);
  return { service, user, tokens, sessions, sent, email, prisma };
}

test('valid verification is single-use', async () => {
  const state = setup();
  await state.service.resendVerification(state.user.email, 'ip');
  expect(state.tokens[0].tokenHash).not.toBe(state.sent.verification[0]);
  expect(state.tokens[0].tokenHash).toHaveLength(64);
  await expect(state.service.verifyEmail(state.sent.verification[0])).resolves.toMatchObject({ success: true });
  expect(state.user.isEmailVerified).toBe(true);
  await expect(state.service.verifyEmail(state.sent.verification[0])).rejects.toBeInstanceOf(BadRequestException);
});

test('expired verification token is rejected', async () => {
  const state = setup(); await state.service.resendVerification(state.user.email, 'ip'); state.tokens[0].expiresAt = new Date(Date.now() - 1);
  await expect(state.service.verifyEmail(state.sent.verification[0])).rejects.toBeInstanceOf(BadRequestException);
});

test('verification resend is limited to three deliveries', async () => {
  const state = setup(); for (let i = 0; i < 5; i++) await state.service.resendVerification(state.user.email, 'ip');
  expect(state.email.sendVerification).toHaveBeenCalledTimes(3);
});

test('forgot password does not enumerate accounts', async () => {
  const state = setup();
  const known = await state.service.forgotPassword(state.user.email, 'ip-a');
  const unknown = await state.service.forgotPassword('missing@example.com', 'ip-b');
  expect(known).toEqual(unknown); expect(state.email.sendPasswordReset).toHaveBeenCalledTimes(1);
});

test('valid reset changes Argon2id password, revokes sessions, and token cannot be reused', async () => {
  const state = setup(); state.user.passwordHash = await CryptoUtil.hashPassword('OldPassword123!');
  await state.service.forgotPassword(state.user.email, 'ip'); const raw = state.sent.reset[0];
  await expect(state.service.resetPassword(raw, 'NewPassword123!', 'ip')).resolves.toMatchObject({ success: true });
  expect(await CryptoUtil.verifyPassword(state.user.passwordHash, 'NewPassword123!')).toBe(true);
  expect(await CryptoUtil.verifyPassword(state.user.passwordHash, 'OldPassword123!')).toBe(false);
  expect(state.sessions[0].isRevoked).toBe(true); expect(state.sent.changed).toBe(1);
  await expect(state.service.resetPassword(raw, 'AnotherPassword123!', 'ip')).rejects.toBeInstanceOf(BadRequestException);
  state.user.isEmailVerified = true;
  await expect(state.service.login({ email: state.user.email, password: 'OldPassword123!' })).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(state.service.login({ email: state.user.email, password: 'NewPassword123!' })).resolves.toHaveProperty('user.id', state.user.id);
});

test('MFA recovery code signs in once and cannot be reused', async () => {
  const state = setup();
  state.user.passwordHash = await CryptoUtil.hashPassword('CurrentPassword123!');
  state.user.isEmailVerified = true;
  state.user.mfaEnabled = true;
  state.user.mfaRecoveryCodes = [CryptoUtil.hashToken('single-use-recovery')];
  const credentials = { email: state.user.email, password: 'CurrentPassword123!' };
  await expect(state.service.login(credentials)).resolves.toMatchObject({ mfaRequired: true });
  await expect(state.service.login({ ...credentials, recoveryCode: 'single-use-recovery' })).resolves.toHaveProperty('user.id', state.user.id);
  expect(state.user.mfaRecoveryCodes).toEqual([]);
  await expect(state.service.login({ ...credentials, recoveryCode: 'single-use-recovery' })).rejects.toBeInstanceOf(UnauthorizedException);
});

test('invalid and expired reset tokens are rejected', async () => {
  const state = setup();
  await expect(state.service.resetPassword('invalid', 'NewPassword123!', 'ip')).rejects.toBeInstanceOf(BadRequestException);
  await state.service.forgotPassword(state.user.email, 'ip'); state.tokens.find(item => item.type === AuthActionTokenType.PASSWORD_RESET).expiresAt = new Date(Date.now() - 1);
  await expect(state.service.resetPassword(state.sent.reset[0], 'NewPassword123!', 'ip')).rejects.toBeInstanceOf(BadRequestException);
});

test('registration remains pending after email failure, prevents duplicates, and resend can deliver', async () => {
  const users: any[] = [];
  const tokens: any[] = [];
  const prisma: any = {
    isConnected: true,
    role: { findUnique: jest.fn(async () => ({ id: 'role-user' })) },
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find(user => user.email === where.email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const user = { id: data.id, email: data.email, fullName: data.fullName, defaultPrivacyMode: data.defaultPrivacyMode, roles: ['USER'], isActive: true, isEmailVerified: false };
        users.push(user);
        return user;
      }),
    },
    authActionToken: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of tokens) if (token.userId === where.userId && token.type === where.type && token.usedAt === null) { Object.assign(token, data); count++; }
        return { count };
      }),
      create: jest.fn(async ({ data }: any) => { const token = { id: `token-${tokens.length + 1}`, ...data }; tokens.push(token); return token; }),
    },
    $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
  };
  const email = {
    sendVerification: jest.fn()
      .mockRejectedValueOnce(new Error('provider timeout'))
      .mockResolvedValueOnce(undefined),
  };
  const audit = { log: jest.fn(async () => undefined) };
  const security: any = { isRateLimited: () => false, recordFailedLogin: jest.fn() };
  const service = new AuthService(prisma, { sign: jest.fn(() => 'signed-token') } as any, { get: jest.fn(), getOrThrow: jest.fn(() => 'x'.repeat(40)) } as any, audit as any, security, email as any);

  const first = await service.register({ fullName: 'New Person', email: 'new@example.com', password: 'Password123!' });
  expect(first).toMatchObject({ verificationRequired: true, verificationPending: true, verificationEmailStatus: 'FAILED' });
  expect(users).toHaveLength(1);
  expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMAIL_VERIFICATION_DELIVERY_FAILED', result: 'FAILURE', details: { source: 'registration' } }));

  await expect(service.register({ fullName: 'New Person', email: 'new@example.com', password: 'Password123!' })).rejects.toBeInstanceOf(ConflictException);
  expect(users).toHaveLength(1);

  const resent = await service.resendVerification('new@example.com', 'ip');
  expect(resent).toMatchObject({ success: true, verificationPending: true, verificationEmailStatus: 'SENT' });
  expect(email.sendVerification).toHaveBeenCalledTimes(2);
});
