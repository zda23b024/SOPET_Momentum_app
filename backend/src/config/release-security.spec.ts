import configuration, { validateProductionEnvironment } from './configuration';
import { AuthController } from '../auth/auth.controller';
import { CsrfService } from '../csrf/csrf.service';

describe('release security configuration', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 'a'.repeat(48), JWT_REFRESH_SECRET: 'b'.repeat(48), FRONTEND_URL: 'https://app.example.com', REDIS_URL: 'redis://test', EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'test@example.com', EMAIL_API_KEY: 'test' };
  });
  afterEach(() => { process.env = { ...original }; });
  it.each(['BOOTSTRAP_ADMIN_ENABLED', 'SEED_DEMO_USERS', 'DEMO_MODE'])('rejects %s in production', key => {
    process.env[key] = 'true';
    expect(() => validateProductionEnvironment()).toThrow(/forbidden in production/);
  });
  it('rejects invalid SameSite and requires explicit secure cross-site cookies', () => {
    process.env.COOKIE_SAME_SITE = 'invalid';
    expect(() => validateProductionEnvironment()).toThrow(/COOKIE_SAME_SITE/);
    process.env.COOKIE_SAME_SITE = 'none';
    expect(() => validateProductionEnvironment()).toThrow(/COOKIE_SECURE/);
    process.env.COOKIE_SECURE = 'true';
    expect(() => validateProductionEnvironment()).not.toThrow();
  });
  it('uses matching configured cookie attributes for login, CSRF, and logout', async () => {
    process.env.COOKIE_SAME_SITE = 'STRICT';
    const values = configuration();
    const config: any = { get: (key: string) => key === 'cookie.secure' ? values.cookie.secure : values.cookie.sameSite };
    const auth: any = { login: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }), logout: jest.fn() };
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    const controller = new AuthController(auth, config);
    await controller.login({} as any, { ip: '127.0.0.1', headers: {} } as any, res);
    new CsrfService(config).issue(res);
    await controller.logout({ id: 'u', sessionId: 's' } as any, res);
    for (const call of res.cookie.mock.calls) expect(call[2]).toMatchObject({ secure: true, sameSite: 'strict', path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', expect.objectContaining({ secure: true, sameSite: 'strict', path: '/' }));
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ secure: true, sameSite: 'strict', path: '/' }));
  });
});
