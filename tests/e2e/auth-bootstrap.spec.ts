import { expect, test } from '@playwright/test';

for (const scenario of ['refresh401', 'refresh403', 'network', 'server500', 'refreshNetwork', 'refresh500', 'restored', 'retry401'] as const) {
  test(`auth bootstrap: ${scenario}`, async ({ page }) => {
    let refreshed = false;
    let meCalls = 0;
    let csrfCalls = 0;
    let refreshCalls = 0;
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      const reply = (status: number, data: unknown) => route.fulfill({ status, json: { data } });
      if (path === '/auth/csrf-token') { csrfCalls++; return reply(200, { csrfToken: 'test-csrf' }); }
      if (path === '/auth/refresh') {
        refreshCalls++;
        expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
        if (scenario === 'refreshNetwork') return route.abort('failed');
        if (scenario === 'refresh500') return reply(503, {});
        if (scenario === 'restored' || scenario === 'retry401') { refreshed = true; return reply(200, {}); }
        return reply(scenario === 'refresh403' ? 403 : 401, {});
      }
      if (path === '/auth/me') {
        meCalls++;
        if (scenario === 'network') return route.abort('failed');
        if (scenario === 'server500') return reply(503, {});
        return refreshed && scenario === 'restored'
          ? reply(200, { user: { id: 'test-user', email: 'test@example.invalid', roles: ['USER'], permissions: [] } })
          : reply(401, {});
      }
      if (path === '/health') return reply(200, { database: 'connected' });
      if (path === '/users/profile') return reply(200, { fullName: 'Test User', email: 'test@example.invalid' });
      if (path.includes('vault')) return reply(200, null);
      return reply(200, []);
    });
    await page.goto('/');
    if (['network', 'server500', 'refreshNetwork', 'refresh500'].includes(scenario)) {
      await expect(page.getByRole('heading', { name: 'Service unavailable' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
    } else if (scenario === 'restored') {
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
      expect(meCalls).toBeGreaterThanOrEqual(2);
      expect(refreshCalls).toBeGreaterThan(0);
      await expect(page.getByRole('heading', { name: 'Service unavailable' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Service unavailable' })).toHaveCount(0);
      expect(csrfCalls).toBeGreaterThan(0);
      expect(refreshCalls).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Create an account' }).click();
      await expect(page.getByRole('button', { name: 'Register', exact: true })).toBeVisible();
    }
  });
}
