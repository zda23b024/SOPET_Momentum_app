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
    await expect(provisionSystemOwner(db, env)).rejects.toThrow('different SYSTEM_OWNER');
    expect(tx.role.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
