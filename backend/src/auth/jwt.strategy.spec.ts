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
});
