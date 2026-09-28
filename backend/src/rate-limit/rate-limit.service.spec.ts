import { RateLimitService } from './rate-limit.service';

test('development limiter normalizes email keys and rejects after the configured registration limit', async () => {
  const service = new RateLimitService({ get: () => '' } as any, { recordSecurityEvent: jest.fn() } as any);
  for (let i = 0; i < 5; i++) await expect(service.check('register', '127.0.0.1', undefined, ' User@Example.test ')).resolves.toBeUndefined();
  await expect(service.check('register', '127.0.0.1', undefined, 'user@example.test')).rejects.toMatchObject({ status: 429 });
});
