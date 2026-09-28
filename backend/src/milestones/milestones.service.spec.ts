import { ForbiddenException } from '@nestjs/common';
import { ContentEncoding } from '@prisma/client';
import { MilestonesService } from './milestones.service';

const envelope = { version: 1, algorithm: 'AES-256-GCM', keyVersion: 1, iv: 'iv', ciphertext: 'ciphertext', aadVersion: 1, schemaVersion: 1 };

function setup(goal: any) {
  const prisma = {
    isConnected: true,
    goal: { findUnique: jest.fn().mockResolvedValue(goal) },
    milestone: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(value => ({ id: 'milestone-1', ...value.data })), update: jest.fn(), delete: jest.fn() },
  } as any;
  return { service: new MilestonesService(prisma), prisma };
}

describe('MilestonesService persistence boundary', () => {
  it('creates an owned standard milestone in PostgreSQL', async () => {
    const { service, prisma } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: 'STANDARD_PRIVATE' });
    await service.create('user-1', { goalId: 'goal-1', title: 'First waypoint', targetDate: '2026-10-01' });
    expect(prisma.milestone.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ goalId: 'goal-1', title: 'First waypoint' }) }));
  });

  it('rejects plaintext under a protected goal', async () => {
    const { service, prisma } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: 'HIGHLY_CONFIDENTIAL' });
    await expect(service.create('user-1', { goalId: 'goal-1', title: 'Secret' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.milestone.create).not.toHaveBeenCalled();
  });

  it('stores only the encrypted envelope under a protected goal', async () => {
    const { service, prisma } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: 'ENCRYPTED_PRIVATE' });
    await service.create('user-1', { goalId: 'goal-1', contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: envelope });
    expect(prisma.milestone.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: null, contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: envelope }) }));
  });
});
