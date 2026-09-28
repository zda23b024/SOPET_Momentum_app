import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async userExport(userId: string) {
    if (!this.prisma.isConnected) throw new UnauthorizedException('Export requires the persistent data service');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, createdAt: true, lastLoginAt: true, defaultPrivacyMode: true } });
    if (!user) throw new ForbiddenException();
    if (!user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > 15 * 60 * 1000) throw new UnauthorizedException('Recent authentication is required for export');
    const goals = await this.prisma.goal.findMany({ where: { userId }, include: { milestones: true, actions: { include: { nmaRecords: true, readinessAssessments: true, barriers: { include: { interventions: true } }, mmaChildActions: true } }, kpis: { include: { values: true } }, reviews: { include: { lessons: true, adjustments: true } }, interruptions: true, lessons: true, accessGrants: { select: { granteeUserId: true, permission: true, status: true, expiresAt: true } } } });
    const encrypted = goals.filter(g => g.privacyMode !== 'STANDARD_PRIVATE').map(g => g.id);
    await this.audit.log({ actorId: userId, action: 'USER_DATA_EXPORT_CREATED', targetId: userId, targetType: 'USER', details: { goalCount: goals.length, encryptedGoalCount: encrypted.length } });
    // Ciphertext is returned untouched. The browser can decrypt only after its vault is unlocked.
    return { format: 'sopet-user-export/v1', createdAt: new Date().toISOString(), user, goals, encryptedGoalIds: encrypted, notice: encrypted.length ? 'Encrypted records remain ciphertext; decrypt locally after Privacy Vault unlock.' : undefined };
  }
}
