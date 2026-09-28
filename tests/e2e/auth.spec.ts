import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 15000, navigationTimeout: 30000 });
test('verified synthetic accounts authenticate and sign out', async ({ browser }) => {
  test.setTimeout(240000);
  const require = createRequire(new URL('../../backend/package.json', import.meta.url));
  const env = require('dotenv').parse(readFileSync('backend/.env'));
  if (new URL(env.DATABASE_URL).pathname !== '/sopet_momentum_staging') throw new Error('Staging database guard failed');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: [] });
  const diagnostic = process.env.AUTH_DIAGNOSTIC === '1';
  const sequence = ['A'];
  const report: any = { database: 'sopet_momentum_staging', network: [], logins: [], http500: [], consoleErrors: [], pageErrors: [], setup: false };
  let phase = 'setup';
  const createdUserIds: string[] = [];
  try {
    phase = 'database identity query';
    const db: any = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
    if (db[0].name !== report.database) throw new Error('Database identity guard failed');
    phase = 'USER role lookup';
    const role = await prisma.role.findUnique({ where: { name: 'USER' } });
    report.userRolePresent = Boolean(role);
    if (!role) throw new Error('USER role baseline is missing');
    const users: any = {};
    const run = randomBytes(8).toString('hex');
    for (const label of [...new Set(sequence)]) {
      const password = randomBytes(32).toString('base64url');
      const email = `auth-e2e-${run}-${label.toLowerCase()}@example.invalid`;
      phase = `create synthetic ${label}`;
      const user = await prisma.user.create({ data: {
        email, passwordHash: await require('argon2').hash(password), fullName: `Synthetic Auth User ${label}`,
        isEmailVerified: true, mfaRecoveryCodes: [], profile: { create: {} },
        userRoles: { create: { roleId: role.id } },
      }, select: { id: true, isEmailVerified: true } });
      createdUserIds.push(user.id);
      users[label] = { ...user, email, password };
    }
    report.setup = true;
    const pending: Promise<void>[] = [];
    const configurePage = (page: any, context: any) => {
      const requestPhases = new WeakMap<object, string>();
      page.on('request', (r: any) => requestPhases.set(r, phase));
      page.on('response', (r: any) => {
        const path = new URL(r.url()).pathname;
        if (!path.startsWith('/api/')) return;
        const row: any = { method: r.request().method(), path, status: r.status(), phase: requestPhases.get(r.request()) };
        report.network.push(row);
        pending.push((async () => {
          row.cookieNames = ((await r.request().headerValue('cookie')) ?? '').split(';').map(v => v.trim().split('=')[0]).filter(Boolean);
          if (path.endsWith('/auth/me') && r.ok()) {
            const body = await r.json();
            const user = (body.data ?? body).user;
            row.userSchemaValid = typeof user?.id === 'string' && Array.isArray(user?.roles) && user.roles.includes('USER') && Array.isArray(user?.permissions);
            row.roles = user?.roles;
            row.permissionCount = user?.permissions?.length;
          }
          if (path.endsWith('/auth/login')) {
            row.setCookieNames = (await r.headersArray()).filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value.split('=')[0]);
            row.storedCookieNames = (await context.cookies()).map(c => c.name);
            phase = 'immediately after login / dashboard bootstrap';
          }
        })());
      });
      page.on('response', (r: any) => { if (r.status() === 500) report.http500.push({ path: new URL(r.url()).pathname, status: 500 }); });
      page.on('console', (m: any) => { if (m.type() === 'error') report.consoleErrors.push({ phase, message: /^Failed to load resource: the server responded with a status of \d+/.exec(m.text())?.[0] || 'Console error text withheld (not allowlisted)' }); });
      page.on('pageerror', () => report.pageErrors.push({ phase, message: 'Uncaught browser exception; text withheld' }));
    };
    for (const [index, label] of sequence.entries()) {
      const context = await browser.newContext();
      const page = await context.newPage();
      configurePage(page, context);
      const row: any = { user: label, attempt: label === 'A' ? index + 1 : 1, status: null, navigation: false, page: false, logout: false };
      report.logins.push(row);
      phase = 'anonymous bootstrap before login';
      try {
        await page.goto('http://localhost:3000');
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30000 });
        await page.getByLabel('Email address').fill(users[label].email);
        await page.getByLabel('Password', { exact: true }).fill(users[label].password);
        const login = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/login') && r.request().method() === 'POST');
        phase = 'login submit';
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        row.status = (await login).status();
        if (row.status !== 200) throw new Error('Login response was not successful');
        await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 30000 });
        row.navigation = true;
        phase = `${label} authenticated settings`;
        await page.getByRole('button', { name: 'Account menu' }).click();
        const profile = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/users/profile') && r.request().method() === 'GET');
        await page.getByRole('button', { name: 'Account & Privacy Settings' }).click();
        const response = await profile;
        row.profileStatus = response.status();
        const body = await response.json();
        row.correctIdentity = (body.data ?? body).id === users[label].id;
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Verified', { exact: true })).toBeVisible();
        row.page = response.ok() && row.correctIdentity;
      } catch { row.failurePhase = phase; }
      finally {
        if (row.status === 200) {
        phase = `${label} logout`;
          try {
            await page.getByRole('button', { name: 'Account menu' }).click();
            const logout = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/logout') && r.request().method() === 'POST');
            await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
            row.logoutStatus = (await logout).status();
            await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 15000 });
            phase = 'post-logout session invalidation (expected)';
            const denied = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
            row.afterLogoutStatus = denied;
            row.logout = row.logoutStatus === 200 && denied === 401;
          } catch { row.logout = false; }
        }
      }
      const shouldStop = row.status === 429 || (row.status === 200 && !row.logout);
      await context.close();
      if (shouldStop) break;
    }
    await Promise.all(pending);
  } catch (error: any) { report.failurePhase = phase; report.safeErrorCode = /^P\d{4}$/.test(error?.code) ? error.code : 'UNCLASSIFIED'; }
  finally {
    try {
      const cleanup = createdUserIds.length ? await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }) : { count: 0 };
      report.cleanup = { created: createdUserIds.length, deleted: cleanup.count };
    } catch {
      report.cleanup = { created: createdUserIds.length, deleted: 0, failed: true };
    }
    await prisma.$disconnect();
    report.pass = report.userRolePresent && report.logins.length === sequence.length && report.logins.every((r: any) => r.status === 200 && r.navigation && r.page && r.logout) && report.network.filter((row: any) => row.path.endsWith('/auth/me') && row.status === 200).every((row: any) => row.userSchemaValid) && !report.http500.length && !report.pageErrors.length && report.cleanup?.deleted === createdUserIds.length;
    writeFileSync(diagnostic ? 'tests/e2e/auth-diagnostic.json' : 'tests/e2e/auth-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
  expect(report.pass, 'See sanitized auth-results.json').toBe(true);
});
