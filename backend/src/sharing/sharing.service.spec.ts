import { ForbiddenException } from '@nestjs/common';
import { GoalAccessGrantStatus, GoalAccessPermission, PrivacyMode, UserRoleType } from '@prisma/client';
import { SharingService } from './sharing.service';

const staff = {
  id: 'admin-a',
  isActive: true,
  userRoles: [{ role: { name: UserRoleType.SUPPORT_ADMIN } }],
  permissions: ['goal.shared.request', 'goal.shared.view'],
};

const user = { id: 'admin-a', email: 'support@example.com', roles: ['SUPPORT_ADMIN'], permissions: staff.permissions };

function makeService(overrides: Record<string, any> = {}) {
  const prisma = {
    isConnected: true,
    goal: { findUnique: jest.fn() },
    goalAccessGrant: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    goalAccessRequest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    adminSharingKey: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
    ...overrides,
  } as any;
  const audit = { log: jest.fn() } as any;
  return { service: new SharingService(prisma, audit), prisma, audit };
}

describe('SharingService authorization', () => {
  it('denies an eligible admin without an active grant', async () => {
    const { service, prisma } = makeService();
    prisma.goalAccessGrant.updateMany.mockResolvedValue({ count: 0 });
    prisma.goalAccessGrant.findFirst.mockResolvedValue(null);

    await expect(service.getSharedGoal(user, 'goal-b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.goal.findUnique).not.toHaveBeenCalled();
  });

  it('returns only the specific grantee active grant', async () => {
    const { service, prisma } = makeService();
    prisma.goalAccessGrant.updateMany.mockResolvedValue({ count: 0 });
    prisma.goalAccessGrant.findMany.mockResolvedValue([{ id: 'grant-b', goalId: 'goal-b' }]);

    await service.listSharedWithMe(user);
    expect(prisma.goalAccessGrant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ granteeUserId: 'admin-a', permission: GoalAccessPermission.VIEW, status: GoalAccessGrantStatus.ACTIVE }),
    }));
  });

  it('rejects encrypted sharing without an admin-specific envelope', async () => {
    const { service, prisma } = makeService();
    prisma.goal.findUnique.mockResolvedValue({ id: 'goal-secret', userId: 'owner-1', privacyMode: PrivacyMode.ENCRYPTED_PRIVATE });

    await expect(service.grant('owner-1', 'goal-secret', {
      granteeUserId: 'admin-a',
      permission: GoalAccessPermission.VIEW,
    } as any)).rejects.toThrow('encrypted key envelope');
    expect(prisma.goalAccessGrant.create).not.toHaveBeenCalled();
  });

  it('rejects a grant to an ineligible administrator account', async () => {
    const { service, prisma } = makeService();
    prisma.goal.findUnique.mockResolvedValue({ id: 'goal-a', userId: 'owner-1', privacyMode: PrivacyMode.STANDARD_PRIVATE });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-b', isActive: true, userRoles: [{ role: { name: UserRoleType.ANALYTICS_ADMIN } }] });

    await expect(service.grant('owner-1', 'goal-a', { granteeUserId: 'admin-b', permission: GoalAccessPermission.VIEW } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not give SYSTEM_OWNER private Goal access by role alone', async () => {
    const { service, prisma } = makeService();
    const systemOwner = { ...user, roles: ['SYSTEM_OWNER'] };
    prisma.goalAccessGrant.updateMany.mockResolvedValue({ count: 0 });
    prisma.goalAccessGrant.findFirst.mockResolvedValue(null);
    await expect(service.getSharedGoal(systemOwner, 'goal-secret')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.goal.findUnique).not.toHaveBeenCalled();
  });

  it('approves a request by creating its active grant in the same transaction', async () => {
    const { service, prisma } = makeService();
    prisma.goal.findUnique.mockResolvedValue({ id: 'goal-a', userId: 'owner-1', privacyMode: PrivacyMode.STANDARD_PRIVATE });
    prisma.goalAccessRequest.findFirst.mockResolvedValue({
      id: 'request-1', goalId: 'goal-a', ownerUserId: 'owner-1', requesterId: 'admin-a', reason: 'Requested support',
      requester: { id: 'admin-a', isActive: true, userRoles: [{ role: { name: UserRoleType.SUPPORT_ADMIN, permissions: [{ permission: { code: 'goal.shared.request' } }, { permission: { code: 'goal.shared.view' } }] } }] },
    });
    prisma.goalAccessGrant.findFirst.mockResolvedValue(null);
    prisma.goalAccessGrant.create.mockResolvedValue({ id: 'grant-1', permission: GoalAccessPermission.VIEW });
    prisma.goalAccessRequest.update.mockResolvedValue({ id: 'request-1' });

    await expect(service.approveRequest('owner-1', 'goal-a', 'request-1', {})).resolves.toEqual(expect.objectContaining({ id: 'grant-1' }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.goalAccessGrant.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: GoalAccessGrantStatus.ACTIVE, granteeUserId: 'admin-a' }) }));
    expect(prisma.goalAccessRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }));
  });
});
