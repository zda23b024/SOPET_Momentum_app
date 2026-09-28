import { UnauthorizedException } from '@nestjs/common';
import { cookieAccessTokenExtractor, JwtStrategy } from './jwt.strategy';

describe('cookie-only JWT authentication', () => {
  it('ignores authorization headers and reads only the access cookie', () => {
    expect(cookieAccessTokenExtractor({ cookies: {} })).toBeNull();
    expect(cookieAccessTokenExtractor({ cookies: { accessToken: 'cookie-token' } })).toBe('cookie-token');
  });

  it('rejects a revoked session', async () => {
    const config = { getOrThrow: () => 'test-secret-at-least-thirty-two-characters' } as any;
    const prisma = { isConnected: true, session: { findUnique: jest.fn().mockResolvedValue({ isRevoked: true, expiresAt: new Date(Date.now() + 10000) }) } } as any;
    const strategy = new JwtStrategy(config, prisma);
    await expect(strategy.validate({ sub: 'user-1', email: 'u@example.test', roles: [], permissions: [], sessionId: 'session-1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses current database roles rather than stale token claims', async () => {
    const config = { getOrThrow: () => 'test-secret-at-least-thirty-two-characters' } as any;
    const prisma = { isConnected: true, session: { findUnique: jest.fn().mockResolvedValue({ isRevoked: false, expiresAt: new Date(Date.now() + 10000) }) }, user: { findUnique: jest.fn().mockResolvedValue({ email: 'u@example.test', isActive: true, mfaEnabled: true, defaultPrivacyMode: 'STANDARD_PRIVATE', userRoles: [{ role: { name: 'USER', permissions: [{ permission: { code: 'goal.read_own' } }] } }] }) } } as any;
    const user = await new JwtStrategy(config, prisma).validate({ sub: 'user-1', email: 'u@example.test', roles: ['SYSTEM_OWNER'], permissions: ['admin.dashboard.view'], sessionId: 'session-1' });
    expect(user.roles).toEqual(['USER']);
    expect(user.permissions).toEqual(['goal.read_own']);
  });
});
