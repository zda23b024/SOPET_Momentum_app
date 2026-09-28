import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleType } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('administration authorization and safety', () => {
  const contextFor = (method: keyof AdminController, user: any) => ({
    getHandler: () => AdminController.prototype[method],
    getClass: () => AdminController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

  it('requires both an admin role and the dashboard/user permission', () => {
    const guard = new RolesGuard(new Reflector());
    expect(() => guard.canActivate(contextFor('getUsers', { roles: ['USER'], permissions: ['admin.dashboard.view', 'admin.users.view'] }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('getUsers', { roles: ['SYSTEM_OWNER'], permissions: ['admin.users.view'] }))).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor('getUsers', { roles: ['SYSTEM_OWNER'], permissions: ['admin.dashboard.view', 'admin.users.view'], mfaEnabled: true }))).toBe(true);
  });

  it('requires MFA for production system owner administration', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const guard = new RolesGuard(new Reflector());
      expect(() => guard.canActivate(contextFor('getUsers', { roles: ['SYSTEM_OWNER'], permissions: ['admin.dashboard.view', 'admin.users.view'], mfaEnabled: false }))).toThrow(ForbiddenException);
    } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  });

  const setup = () => {
    const transaction: any = {
      $executeRawUnsafe: jest.fn(),
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'target', isActive: true, userRoles: [{ role: { name: UserRoleType.SYSTEM_OWNER } }] }), count: jest.fn().mockResolvedValue(1), update: jest.fn() },
      userRole: { upsert: jest.fn(), deleteMany: jest.fn() },
      session: { updateMany: jest.fn() },
    };
    const prisma: any = { isConnected: true, $transaction: jest.fn(async (work: any) => work(transaction)), role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-id' }) }, user: { findMany: jest.fn().mockResolvedValue([]) } };
    const audit: any = { log: jest.fn() };
    return { service: new AdminService(prisma, audit, {} as any, {} as any), transaction, prisma, audit };
  };

  it('never projects passwords, goals, tokens, or private content into the user list', async () => {
    const { service, prisma } = setup();
    await service.getUsers();
    const selection = prisma.user.findMany.mock.calls[0][0].select;
    expect(selection.passwordHash).toBeUndefined();
    expect(selection.goals).toBeUndefined();
    expect(selection.mfaSecret).toBeUndefined();
    expect(selection.sessions).toBeUndefined();
  });

  it('rejects self role changes and the last active owner demotion', async () => {
    const { service, transaction } = setup();
    await expect(service.changeUserRole('target', 'target', { role: UserRoleType.SYSTEM_OWNER, action: 'revoke' })).rejects.toThrow(ForbiddenException);
    await expect(service.changeUserRole('actor', 'target', { role: UserRoleType.SYSTEM_OWNER, action: 'revoke' })).rejects.toThrow(ForbiddenException);
    expect(transaction.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('assigns a permitted role and revokes stale sessions', async () => {
    const { service, transaction, audit } = setup();
    await service.changeUserRole('actor', 'target', { role: UserRoleType.SUPPORT_ADMIN, action: 'assign' });
    expect(transaction.userRole.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_roleId: { userId: 'target', roleId: 'role-id' } } }));
    expect(transaction.session.updateMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_ROLE_ASSIGNED', targetId: 'target' }));
  });

  it('cannot deactivate the last active system owner', async () => {
    const { service, transaction } = setup();
    await expect(service.setAccountStatus('actor', 'target', false)).rejects.toThrow(ForbiddenException);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });
});
