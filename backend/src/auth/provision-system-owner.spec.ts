import { provisionSystemOwner } from '../../scripts/provision-system-owner';
import { CryptoUtil } from '../common/utils/crypto.util';
const env = { PROVISION_SYSTEM_OWNER_EMAIL: ' Owner@Example.com ', PROVISION_SYSTEM_OWNER_PASSWORD: 'Test-only!Password9382' };
function setup(existing = false, ownerIds: string[] = []) {
  let user: any = existing ? { id: 'u' } : undefined;
  const owners = ownerIds.map(userId => ({ userId }));
  const tx: any = {
    $executeRawUnsafe: jest.fn(),
    user: { findMany: jest.fn(async () => user ? [user] : []), create: jest.fn(async ({ data }) => (user = { id: 'u', ...data })), update: jest.fn(async ({ data }) => Object.assign(user, data)) },
    role: { upsert: jest.fn(async () => ({ id: 'r' })) },
    userRole: { findMany: jest.fn(async () => owners), upsert: jest.fn(async ({ create }) => { owners.push({ userId: create.userId }); return create; }) },
    session: { updateMany: jest.fn() }, authActionToken: { deleteMany: jest.fn() },
  };
  return { tx, db: { $transaction: jest.fn(async fn => fn(tx)) } as any };
}
describe('one-time production owner provisioning', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([{}, { ...env, PROVISION_SYSTEM_OWNER_EMAIL: 'invalid' }, { ...env, PROVISION_SYSTEM_OWNER_PASSWORD: 'weak' }, { BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com', BOOTSTRAP_ADMIN_PASSWORD: env.PROVISION_SYSTEM_OWNER_PASSWORD }])('rejects missing or invalid dedicated credentials', async input => {
    const { db } = setup();
    await expect(provisionSystemOwner(db, input)).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('creates one owner with normal Argon2id hashing and preserves credentials on rerun', async () => {
    const { tx, db } = setup();
    const hash = jest.spyOn(CryptoUtil, 'hashPassword');
    expect(await provisionSystemOwner(db, env)).toBe('provisioned');
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: 'owner@example.com', isActive: true, isEmailVerified: true });
    expect(data.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(await CryptoUtil.verifyPassword(data.passwordHash, env.PROVISION_SYSTEM_OWNER_PASSWORD)).toBe(true);
    expect(await provisionSystemOwner(db, env)).toBe('already-owner');
    expect(hash).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.userRole.upsert).toHaveBeenCalledTimes(1);
    expect(tx.user.update.mock.calls[0][0].data).toEqual({ isActive: true, isEmailVerified: true });
    expect(tx.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(tx.userRole.findMany.mock.invocationCallOrder[0]);
  });
  it('updates existing user and revokes old sessions and recovery links', async () => {
    const { tx, db } = setup(true);
    await provisionSystemOwner(db, env);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'u' }, data: { isRevoked: true } });
    expect(tx.authActionToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
  });
  it.each([['other'], ['u', 'other']])('refuses a different owner without writes', async (...ids) => {
    const { tx, db } = setup(true, ids);
    await expect(provisionSystemOwner(db, env)).rejects.toThrow('different OWNER');
    expect(tx.role.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('explicit owner password reset', () => {
  const reset = { ...env, PROVISION_SYSTEM_OWNER_RESET_PASSWORD: 'true', PROVISION_SYSTEM_OWNER_PASSWORD: 'twelvechars!' };
  afterEach(() => jest.restoreAllMocks());
  it('uses normal reset password rules and changes only password and active/verified flags', async () => {
    const { tx, db } = setup(true, ['u']);
    const hash = jest.spyOn(CryptoUtil, 'hashPassword');
    expect(await provisionSystemOwner(db, reset)).toBe('password-reset');
    expect(hash).toHaveBeenCalledWith(reset.PROVISION_SYSTEM_OWNER_PASSWORD);
    const update = tx.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'u' });
    expect(Object.keys(update.data).sort()).toEqual(['isActive', 'isEmailVerified', 'passwordHash']);
    expect(update.data).toMatchObject({ isActive: true, isEmailVerified: true });
    expect(await CryptoUtil.verifyPassword(update.data.passwordHash, reset.PROVISION_SYSTEM_OWNER_PASSWORD)).toBe(true);
    expect(tx.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'u' }, data: { isRevoked: true } });
    expect(tx.userRole.upsert).not.toHaveBeenCalled();
    expect(tx.role.upsert).not.toHaveBeenCalled();
    expect(tx.authActionToken.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['', 'short'])('rejects missing/short passwords before database work', async password => {
    const { db } = setup(true, ['u']);
    await expect(provisionSystemOwner(db, { ...reset, PROVISION_SYSTEM_OWNER_PASSWORD: password })).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([false, true])('never creates or promotes a non-owner in reset mode', async existing => {
    const { tx, db } = setup(existing);
    await expect(provisionSystemOwner(db, reset)).rejects.toThrow('existing OWNER');
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.role.upsert).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });
  it.each([undefined, 'false', 'TRUE', '1'])('requires exactly true to reset an owner', async flag => {
    const { tx, db } = setup(true, ['u']);
    const hash = jest.spyOn(CryptoUtil, 'hashPassword');
    expect(await provisionSystemOwner(db, { ...env, PROVISION_SYSTEM_OWNER_RESET_PASSWORD: flag })).toBe('already-owner');
    expect(hash).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });
  it('propagates session revocation failure so the transaction rolls back', async () => {
    const { tx, db } = setup(true, ['u']);
    tx.session.updateMany.mockRejectedValue(new Error('session update failed'));
    await expect(provisionSystemOwner(db, reset)).rejects.toThrow('session update failed');
  });
});
