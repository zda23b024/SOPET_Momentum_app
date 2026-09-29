import { UsersService } from './users.service';

describe('scheduled deletion concurrency', () => {
  function setup(locked = true, count = 1) {
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ locked }]), accountDeletionRequest: { updateMany: jest.fn().mockResolvedValue({ count }) }, user: { delete: jest.fn().mockResolvedValue({}) } };
    const prisma: any = { isConnected: true, accountDeletionRequest: { findMany: jest.fn().mockResolvedValue([{ id: 'r', userId: 'u' }]) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const audit: any = { log: jest.fn().mockResolvedValue({}) };
    return { service: new UsersService(prisma, audit, {} as any), tx, audit };
  }
  it('skips contended transactions without deleting or auditing', async () => {
    const { service, tx, audit } = setup(false);
    expect(await service.processDueAccountDeletions()).toEqual({ processed: 0 });
    expect(tx.accountDeletionRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('does not report an already claimed request as deleted', async () => {
    const { service, tx, audit } = setup(true, 0);
    expect(await service.processDueAccountDeletions()).toEqual({ processed: 0 });
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('preserves the audit actor snapshot without a dangling user reference', async () => {
    const { service, audit } = setup();
    expect(await service.processDueAccountDeletions()).toEqual({ processed: 1 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u', actorUserId: null, action: 'ACCOUNT_DELETED' }));
  });
  it('does not emit a successful deletion audit when the transaction fails', async () => {
    const { service, tx, audit } = setup();
    tx.user.delete.mockRejectedValue(new Error('delete failed'));
    expect(await service.processDueAccountDeletions()).toEqual({ processed: 0 });
    expect(audit.log).not.toHaveBeenCalled();
  });
});
