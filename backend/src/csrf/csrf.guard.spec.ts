import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';

const context = (request: any) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe('CsrfGuard', () => {
  const config = { get: jest.fn((key: string) => key === 'frontendUrl' ? 'https://app.example.test' : undefined) } as any;
  const csrf = new CsrfService(config);
  const guard = new CsrfGuard(config, csrf);

  it('allows safe methods without a token', () => {
    expect(guard.canActivate(context({ method: 'GET', headers: {}, cookies: {} }))).toBe(true);
  });

  it('requires matching cookie/header tokens and trusted origin', () => {
    expect(guard.canActivate(context({ method: 'POST', headers: { origin: 'https://app.example.test', 'x-csrf-token': 'token' }, cookies: { sopetCsrf: 'token' } }))).toBe(true);
  });

  it('rejects cross-origin and missing-token mutations', () => {
    expect(() => guard.canActivate(context({ method: 'POST', headers: { origin: 'https://evil.test' }, cookies: {} }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({ method: 'POST', headers: { origin: 'https://app.example.test' }, cookies: {} }))).toThrow(ForbiddenException);
  });
});
