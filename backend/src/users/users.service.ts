import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { AuditService } from '../audit/audit.service';
import { PrivacyMode } from '@prisma/client';
import { EmailService } from '../auth/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async processDueAccountDeletions() {
    if (!this.prisma.isConnected) return { processed: 0 };

    const dueRequests = await this.prisma.accountDeletionRequest.findMany({
      where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
      select: { id: true, userId: true },
      take: 100,
    });

    let processed = 0;
    for (const request of dueRequests) {
      try {
        const deleted = await this.prisma.$transaction(async (transaction) => {
          // Transaction locks stay on one pooled connection and release on rollback.
          const lock = await transaction.$queryRawUnsafe<Array<{ locked: boolean }>>('SELECT pg_try_advisory_xact_lock(87420933) AS locked');
          if (!lock[0]?.locked) return false;
          const updated = await transaction.accountDeletionRequest.updateMany({
            where: { id: request.id, status: 'PENDING' },
            data: { status: 'COMPLETED', confirmedAt: new Date() },
          });
          if (updated.count === 0) return false;
          await transaction.user.delete({ where: { id: request.userId } });
          return true;
        });
        if (!deleted) continue;
        processed++;
        await this.auditService.log({ actorId: request.userId, actorUserId: null, action: 'ACCOUNT_DELETED', targetId: request.userId, targetType: 'USER' });
      } catch (error: any) {
        this.logger.error(`Account deletion ${request.id} failed: ${error?.message || error}`);
      }
    }

    return { processed };
  }

  async getProfile(userId: string) {
    if (this.prisma.isConnected) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, notificationPref: true },
      });
      if (!user) throw new NotFoundException('User not found');
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        privacyMode: user.defaultPrivacyMode,
        mfaEnabled: user.mfaEnabled,
        profile: user.profile,
        notifications: user.notificationPref,
        createdAt: user.createdAt,
      };
    }

    return {
      id: userId,
      email: 'amina@example.com',
      fullName: 'Amina (Pilot Participant)',
      privacyMode: 'STANDARD_PRIVATE',
      mfaEnabled: false,
      createdAt: new Date(),
    };
  }

  async updatePrivacyMode(userId: string, mode: PrivacyMode) {
    if (this.prisma.isConnected) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultPrivacyMode: mode },
      });
    }

    await this.auditService.log({
      actorId: userId,
      action: 'PRIVACY_MODE_UPDATED',
      details: { mode },
    });
    return { success: true, privacyMode: mode };
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (newPass.length < 12) {
      throw new BadRequestException('New password must be at least 12 characters');
    }

    let email: string | undefined;
    if (this.prisma.isConnected) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      email = user.email;

      const isCurrentValid = await CryptoUtil.verifyPassword(user.passwordHash, currentPass);
      if (!isCurrentValid) {
        throw new BadRequestException('Current password does not match');
      }

      const newHash = await CryptoUtil.hashPassword(newPass);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });
      await this.prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    }

    await this.auditService.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      result: 'SUCCESS',
    });
    if (email) await this.emailService.sendPasswordChanged(email);

    return { success: true, message: 'Password changed successfully' };
  }

  async requestAccountDeletion(userId: string) {
    const configured = Number(process.env.ACCOUNT_DELETION_GRACE_PERIOD_SECONDS);
    const seconds = process.env.NODE_ENV === 'production' ? 14 * 24 * 60 * 60 : (Number.isFinite(configured) && configured > 0 ? configured : 14 * 24 * 60 * 60);
    const scheduledFor = new Date(Date.now() + seconds * 1000);

    if (this.prisma.isConnected) {
      const existing = await this.prisma.accountDeletionRequest.findFirst({
        where: { userId, status: 'PENDING' },
      });
      if (existing) return { success: true, message: 'Account deletion is already scheduled.', scheduledFor: existing.scheduledFor };

      await this.prisma.accountDeletionRequest.create({
        data: {
          userId,
          scheduledFor,
          status: 'PENDING',
        },
      });
    }

    await this.auditService.log({
      actorId: userId,
      action: 'ACCOUNT_DELETION_REQUESTED',
      details: { scheduledFor },
    });

    return {
      success: true,
      message: 'Account deletion scheduled. Your data will be permanently purged after the 14-day retention window.',
      scheduledFor,
    };
  }

  async cancelAccountDeletion(userId: string) {
    if (!this.prisma.isConnected) return { success: true, cancelled: false, message: 'No pending account deletion.' };
    const cancelled = await this.prisma.accountDeletionRequest.updateMany({ where: { userId, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    if (cancelled.count) await this.auditService.log({ actorId: userId, action: 'ACCOUNT_DELETION_CANCELLED', targetId: userId, targetType: 'USER' });
    return { success: true, cancelled: cancelled.count > 0, message: cancelled.count ? 'Account deletion cancelled.' : 'No pending account deletion.' };
  }
}
