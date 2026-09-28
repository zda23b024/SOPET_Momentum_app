import { expect, test } from '@playwright/test';

test('SOPET frontend smoke test', async ({ page }) => {
  const serverErrors: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 500) serverErrors.push(response.url());
  });

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).not.toBeEmpty();
  expect(serverErrors).toEqual([]);
});
