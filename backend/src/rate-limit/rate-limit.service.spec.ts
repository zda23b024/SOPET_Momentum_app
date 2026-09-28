import { RateLimitService } from './rate-limit.service';

test('development limiter normalizes email keys and rejects after the configured registration limit', async () => {
  const service = new RateLimitService({ get: () => '' } as any, { recordSecurityEvent: jest.fn() } as any);
  for (let i = 0; i < 5; i++) await expect(service.check('register', '127.0.0.1', undefined, ' User@Example.test ')).resolves.toBeUndefined();
  await expect(service.check('register', '127.0.0.1', undefined, 'user@example.test')).rejects.toMatchObject({ status: 429 });
});

test('admin health distinguishes Redis from an in-memory fallback', async () => {
  const fallback = new RateLimitService({ get: () => '' } as any, {} as any);
  await expect(fallback.inspectRedis()).resolves.toBe('in-memory development fallback');
  const configured = new RateLimitService({ get: () => 'redis://example.invalid' } as any, {} as any);
  (configured as any).redis = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(configured.inspectRedis()).resolves.toBe('unavailable');
});
