import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const configuration = existsSync('backend/.env') ? require('dotenv').parse(readFileSync('backend/.env')) : {};
const adminCredentials = existsSync('backend/.env.admin') ? require('dotenv').parse(readFileSync('backend/.env.admin')) : {};
const stagingDatabase = configuration.DATABASE_URL && new URL(configuration.DATABASE_URL).pathname === '/sopet_momentum_staging';

test('bootstrap administrator sees the guarded dashboard and signs out', async ({ page }) => {
  test.skip(!stagingDatabase || !adminCredentials.BOOTSTRAP_ADMIN_EMAIL || !adminCredentials.BOOTSTRAP_ADMIN_PASSWORD, 'Requires an explicitly bootstrapped staging administrator');
  test.setTimeout(180000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Email address').fill(adminCredentials.BOOTSTRAP_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(adminCredentials.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();
  await page.getByRole('link', { name: 'Administration' }).click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(page.getByRole('heading', { name: 'SOPET Momentum Administration' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Roles & Permissions' }).click();
  await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30000 });
});

test('regular user has no administration menu and direct route is denied', async ({ page }) => {
  test.skip(!stagingDatabase, 'Requires the guarded staging database');
  test.setTimeout(180000);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: configuration.DATABASE_URL } }, log: [] });
  const password = randomBytes(32).toString('base64url');
  const email = `admin-denial-${randomBytes(8).toString('hex')}@example.invalid`;
  let userId: string | undefined;
  try {
    const role = await prisma.role.findUnique({ where: { name: 'USER' }, select: { id: true } });
    if (!role) throw new Error('USER role must be seeded');
    const user = await prisma.user.create({ data: { email, fullName: 'Admin Denial Test', passwordHash: await require('argon2').hash(password), isEmailVerified: true, mfaRecoveryCodes: [], profile: { create: {} }, userRoles: { create: { roleId: role.id } } }, select: { id: true } });
    userId = user.id;
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30000 });
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
    const denied = await page.evaluate(async () => (await fetch('/api/v1/admin/users', { credentials: 'include' })).status);
    expect(denied).toBe(403);
    await page.goto('/administration');
    await expect(page.getByText('Access restricted')).toBeVisible({ timeout: 30000 });
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
