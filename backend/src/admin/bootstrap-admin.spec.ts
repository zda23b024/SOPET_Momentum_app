import { bootstrapAdmin, validateBootstrapConfig } from '../../scripts/bootstrap-admin';
import { validateProductionEnvironment } from '../config/configuration';
import { CryptoUtil } from '../common/utils/crypto.util';

const config = { NODE_ENV: 'development', BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_EMAIL: ' owner@example.invalid ', BOOTSTRAP_ADMIN_PASSWORD: 'DeveloperSelected123!', BOOTSTRAP_ADMIN_ROLE: 'SYSTEM_OWNER' };

describe('development admin bootstrap', () => {
  it('creates a verified owner with the normal password hash', async () => {
    const client: any = { user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }, role: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-role' }) }, permission: { upsert: jest.fn().mockResolvedValue({ id: 'permission-id' }) }, rolePermission: { upsert: jest.fn() } };
    await expect(bootstrapAdmin(client, config)).resolves.toBe('CREATED');
    const created = client.user.create.mock.calls[0][0].data;
    expect(created.isEmailVerified).toBe(true);
    expect(created.userRoles.create.roleId).toBe('owner-role');
    expect(client.rolePermission.upsert).toHaveBeenCalledTimes(6);
    expect(created.passwordHash).not.toBe(config.BOOTSTRAP_ADMIN_PASSWORD);
    expect(await CryptoUtil.verifyPassword(created.passwordHash, config.BOOTSTRAP_ADMIN_PASSWORD)).toBe(true);
  });

  it('never resets or promotes an existing account', async () => {
    const client: any = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() }, role: { findUnique: jest.fn() } };
    await expect(bootstrapAdmin(client, config)).resolves.toBe('EXISTS_UNCHANGED');
    expect(client.user.create).not.toHaveBeenCalled();
    expect(client.role.findUnique).not.toHaveBeenCalled();
  });

  it('rejects production configuration at startup and in the command', () => {
    expect(() => validateBootstrapConfig({ ...config, NODE_ENV: 'production' })).toThrow(/production/);
    const before = { NODE_ENV: process.env.NODE_ENV, BOOTSTRAP_ADMIN_ENABLED: process.env.BOOTSTRAP_ADMIN_ENABLED };
    process.env.NODE_ENV = 'production';
    process.env.BOOTSTRAP_ADMIN_ENABLED = 'true';
    try { expect(() => validateProductionEnvironment()).toThrow(/bootstrap/); }
    finally {
      if (before.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before.NODE_ENV;
      if (before.BOOTSTRAP_ADMIN_ENABLED === undefined) delete process.env.BOOTSTRAP_ADMIN_ENABLED; else process.env.BOOTSTRAP_ADMIN_ENABLED = before.BOOTSTRAP_ADMIN_ENABLED;
    }
  });

  it('rejects demo-user seeding in production', () => {
    const before = { NODE_ENV: process.env.NODE_ENV, BOOTSTRAP_ADMIN_ENABLED: process.env.BOOTSTRAP_ADMIN_ENABLED, SEED_DEMO_USERS: process.env.SEED_DEMO_USERS };
    process.env.NODE_ENV = 'production';
    process.env.BOOTSTRAP_ADMIN_ENABLED = 'false';
    process.env.SEED_DEMO_USERS = 'true';
    try { expect(() => validateProductionEnvironment()).toThrow(/Demo users/); }
    finally {
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
