import { ForbiddenException } from '@nestjs/common';
import { SharingService } from './sharing.service';

test('revoked admin loses server access', async () => {
  const prisma: any = {
    isConnected: true,
    goalAccessGrant: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = new SharingService(prisma, { log: jest.fn() } as any);
  const user: any = { id: 'admin-a', roles: ['ADMIN'], permissions: ['goal.shared.view'] };
  await expect(service.getSharedGoal(user, 'goal-1')).rejects.toBeInstanceOf(ForbiddenException);
  expect(prisma.goalAccessGrant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ granteeUserId: 'admin-a', status: 'ACTIVE' }) }));
});

test('interrupted encrypted revocation resumes with the same rotation token', async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma: any = { isConnected: true, goal: { findUnique: jest.fn().mockResolvedValue({ id: 'goal-1', userId: 'owner-1', privacyMode: 'ENCRYPTED_PRIVATE', goalKeyVersion: 4 }) }, goalAccessGrant: { findFirst: jest.fn().mockResolvedValue({ id: 'grant-a', revocationRotationId: 'rotation-existing' }), findMany, update: jest.fn() }, adminSharingKey: { findFirst: jest.fn() } };
  for (const model of ['milestone','action','nMARecord','readinessAssessment','barrier','actionIntervention','mMA','interruption','restart','kPI','kPIValue','weeklyReview','lesson','adjustment']) prisma[model] = { findMany };
  const service = new SharingService(prisma, { log: jest.fn() } as any);
  const result = await service.beginEncryptedRevocation('owner-1', 'goal-1', 'grant-a');
  expect(result.rotationId).toBe('rotation-existing');
  expect(prisma.goalAccessGrant.update).not.toHaveBeenCalled();
  expect(result.previousGoalKeyVersion).toBe(4);
});
