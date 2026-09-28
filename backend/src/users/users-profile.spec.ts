import { UsersService } from './users.service';

describe('authenticated profile contract', () => {
  it.each([true, false])('returns the stored verification state (%s) without credentials', async (isEmailVerified) => {
    const prisma = {
      isConnected: true,
      user: { findUnique: jest.fn().mockResolvedValue({
        id: 'synthetic-profile', email: 'profile@example.invalid', isEmailVerified,
        passwordHash: 'must-not-be-returned', mfaSecret: 'must-not-be-returned',
      }) },
    };
    const profile = await new UsersService(prisma as any, {} as any, {} as any).getProfile('synthetic-profile');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'synthetic-profile' } }));
    expect(profile).toMatchObject({ id: 'synthetic-profile', isEmailVerified });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('mfaSecret');
  });
});
