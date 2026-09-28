import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('authenticated account settings', () => {
  const createService = () => {
    const transaction = {
      user: { update: jest.fn().mockResolvedValue({}) },
      userProfile: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      isConnected: true,
      $transaction: jest.fn(async (work: (client: typeof transaction) => Promise<void>) => work(transaction)),
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner', email: 'owner@example.invalid', profile: {}, notificationPref: {} }) },
      notificationPreference: { upsert: jest.fn().mockResolvedValue({ emailWeeklyReview: false }) },
      securityEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { service: new UsersService(prisma as any, audit as any, {} as any), prisma, transaction };
  };

  it('updates only the signed-in account profile and rejects invalid timezones', async () => {
    const { service, transaction } = createService();
    await service.updateProfile('owner', { fullName: '  Example Person  ', timezone: 'Africa/Dar_es_Salaam' });
    expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: 'owner' }, data: { fullName: 'Example Person' } });
    expect(transaction.userProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
    await expect(service.updateProfile('owner', { timezone: 'Not/A_Timezone' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates the signed-in account notification preferences', async () => {
    const { service, prisma } = createService();
    await service.updateNotifications('owner', { emailWeeklyReview: false });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      update: expect.objectContaining({ emailWeeklyReview: false }),
      create: expect.objectContaining({ userId: 'owner', emailWeeklyReview: false }),
    });
  });

  it('lists only safe security fields for the signed-in account', async () => {
    const { service, prisma } = createService();
    await service.getSecurityEvents('owner');
    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, eventType: true, severity: true, createdAt: true },
    });
  });
});
