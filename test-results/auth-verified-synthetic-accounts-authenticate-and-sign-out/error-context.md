# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> verified synthetic accounts authenticate and sign out
- Location: tests\e2e\auth.spec.ts:7:1

# Error details

```
Error: See sanitized auth-results.json

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRequire } from 'node:module';
  3  | import { readFileSync, writeFileSync } from 'node:fs';
  4  | import { randomBytes } from 'node:crypto';
  5  | 
  6  | test.use({ trace: 'off', screenshot: 'off', video: 'off' });
  7  | test('verified synthetic accounts authenticate and sign out', async ({ browser }) => {
  8  |   test.setTimeout(240000);
  9  |   const require = createRequire(new URL('../../backend/package.json', import.meta.url));
  10 |   const env = require('dotenv').parse(readFileSync('backend/.env'));
  11 |   if (new URL(env.DATABASE_URL).pathname !== '/sopet_momentum_staging') throw new Error('Staging database guard failed');
  12 |   const { PrismaClient } = require('@prisma/client');
  13 |   const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: [] });
  14 |   const report: any = { database: 'sopet_momentum_staging', logins: [], http500: [], consoleErrors: [], pageErrors: [], setup: false };
  15 |   let phase = 'setup';
  16 |   try {
  17 |     phase = 'database identity query';
  18 |     const db: any = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
  19 |     if (db[0].name !== report.database) throw new Error('Database identity guard failed');
  20 |     phase = 'USER role lookup';
  21 |     const role = await prisma.role.findUnique({ where: { name: 'USER' } });
  22 |     report.userRolePresent = Boolean(role);
  23 |     const users: any = {};
  24 |     const run = randomBytes(8).toString('hex');
  25 |     for (const label of ['A', 'B', 'C']) {
  26 |       const password = randomBytes(32).toString('base64url');
  27 |       const email = `auth-e2e-${run}-${label.toLowerCase()}@example.invalid`;
  28 |       phase = `create synthetic ${label}`;
  29 |       const user = await prisma.user.create({ data: {
  30 |         email, passwordHash: await require('argon2').hash(password), fullName: `Synthetic Auth User ${label}`,
  31 |         isEmailVerified: true, mfaRecoveryCodes: [], profile: { create: {} },
  32 |         ...(role ? { userRoles: { create: { roleId: role.id } } } : {}),
  33 |       }, select: { id: true, isEmailVerified: true } });
  34 |       users[label] = { ...user, email, password };
  35 |     }
  36 |     report.setup = true;
  37 |     const context = await browser.newContext();
  38 |     const page = await context.newPage();
  39 |     page.on('response', r => { if (r.status() === 500) report.http500.push({ path: new URL(r.url()).pathname, status: 500 }); });
  40 |     // Allowlist messages; arbitrary console text may contain credentials.
  41 |     page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ phase, message: /^Failed to load resource: the server responded with a status of \d+/.exec(m.text())?.[0] || 'Console error text withheld (not allowlisted)' }); });
  42 |     page.on('pageerror', () => report.pageErrors.push({ phase, message: 'Uncaught browser exception; text withheld' }));
  43 |     for (const [index, label] of ['A', 'A', 'A', 'B', 'C'].entries()) {
  44 |       const row: any = { user: label, attempt: label === 'A' ? index + 1 : 1, status: null, navigation: false, page: false, logout: false };
  45 |       report.logins.push(row);
  46 |       phase = `${label} login ${row.attempt}`;
  47 |       try {
  48 |         await page.goto('http://localhost:3000');
  49 |         await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  50 |         await page.getByLabel('Email address').fill(users[label].email);
  51 |         await page.getByLabel('Password', { exact: true }).fill(users[label].password);
  52 |         const login = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/login') && r.request().method() === 'POST');
  53 |         await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  54 |         row.status = (await login).status();
  55 |         if (row.status !== 200) continue;
  56 |         await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 15000 });
  57 |         row.navigation = true;
  58 |         phase = `${label} authenticated settings`;
  59 |         await page.getByRole('button', { name: 'Account menu' }).click();
  60 |         const profile = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/users/profile') && r.request().method() === 'GET');
  61 |         await page.getByRole('button', { name: 'Account & Privacy Settings' }).click();
  62 |         const response = await profile;
  63 |         row.profileStatus = response.status();
  64 |         const body = await response.json();
  65 |         row.correctIdentity = (body.data ?? body).id === users[label].id;
  66 |         await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  67 |         await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  68 |         row.page = response.ok() && row.correctIdentity;
  69 |       } catch { row.failurePhase = phase; }
  70 |       finally {
  71 |         if (row.navigation) {
  72 |           phase = `${label} logout`;
  73 |           try {
  74 |             await page.getByRole('button', { name: 'Account menu' }).click();
  75 |             const logout = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/logout') && r.request().method() === 'POST');
  76 |             await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  77 |             row.logoutStatus = (await logout).status();
  78 |             await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 15000 });
  79 |             const denied = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
  80 |             row.afterLogoutStatus = denied;
  81 |             row.logout = row.logoutStatus === 200 && denied === 401;
  82 |           } catch { row.logout = false; }
  83 |         }
  84 |       }
  85 |       if (row.status === 429 || (row.navigation && !row.logout)) break;
  86 |     }
  87 |     await context.close();
  88 |   } catch (error: any) { report.failurePhase = phase; report.safeErrorCode = /^P\d{4}$/.test(error?.code) ? error.code : 'UNCLASSIFIED'; }
  89 |   finally {
  90 |     await prisma.$disconnect();
  91 |     report.pass = report.logins.length === 5 && report.logins.every((r: any) => r.status === 200 && r.navigation && r.page && r.logout) && !report.http500.length && !report.pageErrors.length;
  92 |     writeFileSync('tests/e2e/auth-results.json', JSON.stringify(report, null, 2));
  93 |     console.log(JSON.stringify(report));
  94 |   }
> 95 |   expect(report.pass, 'See sanitized auth-results.json').toBe(true);
     |                                                          ^ Error: See sanitized auth-results.json
  96 | });
  97 | 
```