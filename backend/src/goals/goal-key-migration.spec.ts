import { BadRequestException } from '@nestjs/common';
import { PrivacyMigrationStatus, PrivacyMode } from '@prisma/client';
import { GoalsService } from './goals.service';

const envelope = { version: 1, algorithm: 'AES-256-GCM', keyVersion: 1, iv: 'iv', ciphertext: 'ciphertext', aadVersion: 1, schemaVersion: 1 };
const collectionNames = ['milestones', 'actions', 'nmaRecords', 'readinessAssessments', 'barriers', 'actionInterventions', 'mmas', 'interruptions', 'restarts', 'kpis', 'kpiValues', 'weeklyReviews', 'lessons', 'adjustments'];

function setup(goal: any) {
  const emptyModel = { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() };
  const prisma: any = {
    isConnected: true,
    goal: { ...emptyModel, findFirst: jest.fn().mockResolvedValue(goal), findUnique: jest.fn().mockResolvedValue(goal), update: jest.fn(), updateMany: jest.fn() },
    milestone: { ...emptyModel }, action: { ...emptyModel }, nMARecord: { ...emptyModel }, readinessAssessment: { ...emptyModel }, barrier: { ...emptyModel }, actionIntervention: { ...emptyModel }, mMA: { ...emptyModel }, interruption: { ...emptyModel }, restart: { ...emptyModel }, kPI: { ...emptyModel }, kPIValue: { ...emptyModel }, weeklyReview: { ...emptyModel }, lesson: { ...emptyModel }, adjustment: { ...emptyModel },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  return { service: new GoalsService(prisma, { log: jest.fn() } as any), prisma };
}

describe('Goal GDEK migration transaction', () => {
  it('atomically commits encrypted-only data and marks the Goal complete', async () => {
    const { service, prisma } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: PrivacyMode.HIGHLY_CONFIDENTIAL, ownerWrappedGoalKey: null, goalKeyVersion: 1, privacyMigrationStatus: PrivacyMigrationStatus.IN_PROGRESS, privacyMigrationId: 'migration-1' });
    const payload: any = { migrationId: 'migration-1', goalKeyVersion: 1, ownerWrappedGoalKey: envelope, goalEncryptedPayload: envelope };
    collectionNames.forEach(name => { payload[name] = []; });
    await service.commitGoalKeyMigration('user-1', 'goal-1', payload);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.goal.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: null, description: null, whyItMatters: null, ownerWrappedGoalKey: envelope, privacyMigrationStatus: PrivacyMigrationStatus.COMPLETED }) }));
  });

  it('never migrates a standard private Goal', async () => {
    const { service } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: PrivacyMode.STANDARD_PRIVATE, ownerWrappedGoalKey: null, goalKeyVersion: 1, privacyMigrationStatus: PrivacyMigrationStatus.IN_PROGRESS, privacyMigrationId: 'migration-1' });
    const payload: any = { migrationId: 'migration-1', goalKeyVersion: 1, ownerWrappedGoalKey: envelope, goalEncryptedPayload: envelope };
    collectionNames.forEach(name => { payload[name] = []; });
    await expect(service.commitGoalKeyMigration('user-1', 'goal-1', payload)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects plaintext properties hidden alongside an envelope', async () => {
    const { service } = setup({ id: 'goal-1', userId: 'user-1', privacyMode: PrivacyMode.ENCRYPTED_PRIVATE, ownerWrappedGoalKey: null, goalKeyVersion: 1, privacyMigrationStatus: PrivacyMigrationStatus.IN_PROGRESS, privacyMigrationId: 'migration-1' });
    const payload: any = { migrationId: 'migration-1', goalKeyVersion: 1, ownerWrappedGoalKey: envelope, goalEncryptedPayload: { ...envelope, title: 'must-not-persist' } };
    collectionNames.forEach(name => { payload[name] = []; });
    await expect(service.commitGoalKeyMigration('user-1', 'goal-1', payload)).rejects.toBeInstanceOf(BadRequestException);
  });
});
