import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /auth-bootstrap\.spec\.ts|smoke\.spec\.ts/,
  workers: 1,
  use: { browserName: 'chromium', channel: 'chrome', headless: true, baseURL: 'http://127.0.0.1:3107' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3107 --strictPort',
    url: 'http://127.0.0.1:3107',
    env: { VITE_APP_MODE: 'production', VITE_API_BASE_URL: '/api/v1' },
    reuseExistingServer: false,
  },
});
