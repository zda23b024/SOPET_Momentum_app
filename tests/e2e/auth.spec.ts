import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('verified synthetic accounts authenticate and sign out', async ({ browser }) => {
  test.setTimeout(240000);
  const require = createRequire(new URL('../../backend/package.json', import.meta.url));
  const env = require('dotenv').parse(readFileSync('backend/.env'));
  if (new URL(env.DATABASE_URL).pathname !== '/sopet_momentum_staging') throw new Error('Staging database guard failed');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: [] });
  const report: any = { database: 'sopet_momentum_staging', logins: [], http500: [], consoleErrors: [], pageErrors: [], setup: false };
  let phase = 'setup';
  try {
    phase = 'database identity query';
    const db: any = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
    if (db[0].name !== report.database) throw new Error('Database identity guard failed');
    phase = 'USER role lookup';
    const role = await prisma.role.findUnique({ where: { name: 'USER' } });
    report.userRolePresent = Boolean(role);
    const users: any = {};
    const run = randomBytes(8).toString('hex');
    for (const label of ['A', 'B', 'C']) {
      const password = randomBytes(32).toString('base64url');
      const email = `auth-e2e-${run}-${label.toLowerCase()}@example.invalid`;
      phase = `create synthetic ${label}`;
      const user = await prisma.user.create({ data: {
        email, passwordHash: await require('argon2').hash(password), fullName: `Synthetic Auth User ${label}`,
        isEmailVerified: true, mfaRecoveryCodes: [], profile: { create: {} },
        ...(role ? { userRoles: { create: { roleId: role.id } } } : {}),
      }, select: { id: true, isEmailVerified: true } });
      users[label] = { ...user, email, password };
    }
    report.setup = true;
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('response', r => { if (r.status() === 500) report.http500.push({ path: new URL(r.url()).pathname, status: 500 }); });
    // Allowlist messages; arbitrary console text may contain credentials.
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ phase, message: /^Failed to load resource: the server responded with a status of \d+/.exec(m.text())?.[0] || 'Console error text withheld (not allowlisted)' }); });
    page.on('pageerror', () => report.pageErrors.push({ phase, message: 'Uncaught browser exception; text withheld' }));
    for (const [index, label] of ['A', 'A', 'A', 'B', 'C'].entries()) {
      const row: any = { user: label, attempt: label === 'A' ? index + 1 : 1, status: null, navigation: false, page: false, logout: false };
      report.logins.push(row);
      phase = `${label} login ${row.attempt}`;
      try {
        await page.goto('http://localhost:3000');
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
        await page.getByLabel('Email address').fill(users[label].email);
        await page.getByLabel('Password', { exact: true }).fill(users[label].password);
        const login = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/login') && r.request().method() === 'POST');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        row.status = (await login).status();
        if (row.status !== 200) continue;
        await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 15000 });
        row.navigation = true;
        phase = `${label} authenticated settings`;
        await page.getByRole('button', { name: 'Account menu' }).click();
        const profile = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/users/profile') && r.request().method() === 'GET');
        await page.getByRole('button', { name: 'Account & Privacy Settings' }).click();
        const response = await profile;
        row.profileStatus = response.status();
        const body = await response.json();
        row.correctIdentity = (body.data ?? body).id === users[label].id;
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
        await expect(page.getByText('Verified', { exact: true })).toBeVisible();
        row.page = response.ok() && row.correctIdentity;
      } catch { row.failurePhase = phase; }
      finally {
        if (row.navigation) {
          phase = `${label} logout`;
          try {
            await page.getByRole('button', { name: 'Account menu' }).click();
            const logout = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/logout') && r.request().method() === 'POST');
            await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
            row.logoutStatus = (await logout).status();
            await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 15000 });
            const denied = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
            row.afterLogoutStatus = denied;
            row.logout = row.logoutStatus === 200 && denied === 401;
          } catch { row.logout = false; }
        }
      }
      if (row.status === 429 || (row.navigation && !row.logout)) break;
    }
    await context.close();
  } catch (error: any) { report.failurePhase = phase; report.safeErrorCode = /^P\d{4}$/.test(error?.code) ? error.code : 'UNCLASSIFIED'; }
  finally {
    await prisma.$disconnect();
    report.pass = report.logins.length === 5 && report.logins.every((r: any) => r.status === 200 && r.navigation && r.page && r.logout) && !report.http500.length && !report.pageErrors.length;
    writeFileSync('tests/e2e/auth-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
  expect(report.pass, 'See sanitized auth-results.json').toBe(true);
});
