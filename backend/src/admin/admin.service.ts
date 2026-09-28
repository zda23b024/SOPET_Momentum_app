import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SecurityService } from '../security/security.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CryptoUtil } from '../common/utils/crypto.util';
import { UserRoleType } from '@prisma/client';
import { CreateManagedUserDto } from './dto/managed-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
  ) {}

  async getSystemMetrics() {
    if (this.prisma.isConnected) {
      const [userCount, goalCount, actionCount, completedActions, barrierCount] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.goal.count(),
        this.prisma.action.count(),
        this.prisma.action.count({ where: { status: 'COMPLETED' } }),
        this.prisma.barrier.count(),
      ]);

      return {
        totalUsers: userCount,
        totalGoals: goalCount,
        totalActions: actionCount,
        completedActions,
        totalBarriers: barrierCount,
        activeRatePercent: actionCount > 0 ? Math.round((completedActions / actionCount) * 100) : 0,
        serverTime: new Date().toISOString(),
      };
    }

    return {
      totalUsers: 4,
      totalGoals: 6,
      totalActions: 24,
      completedActions: 18,
      totalBarriers: 8,
      activeRatePercent: 75,
      serverTime: new Date().toISOString(),
    };
  }

  async getRecentAuditLogs(limit = 50) {
    return await this.auditService.getRecentLogs(limit);
  }

  async getRecentSecurityEvents(limit = 50) {
    return await this.securityService.getRecentEvents(limit);
  }

  async listUsers() {
    if (!this.prisma.isConnected) return [];
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, fullName: true, isActive: true, isEmailVerified: true, createdAt: true, userRoles: { select: { role: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ userRoles, ...user }) => ({ ...user, role: userRoles[0]?.role.name ?? UserRoleType.USER }));
  }

  async createManagedUser(actor: AuthenticatedUser, dto: CreateManagedUserDto) {
    this.requireDatabase();
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email already exists');
    const role = await this.requireRole(dto.role as UserRoleType);
    const passwordHash = await CryptoUtil.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email, passwordHash, fullName: dto.fullName?.trim() || null,
        // Owner-created accounts are ready to use; no out-of-band verification token is issued here.
        isEmailVerified: true,
        profile: { create: { displayName: dto.fullName?.trim() || null } },
        notificationPref: { create: {} },
        userRoles: { create: { roleId: role.id } },
      },
      select: { id: true, email: true, fullName: true },
    });
    await this.auditService.log({ actorId: actor.id, actorEmail: actor.email, action: 'MANAGED_USER_CREATED', targetId: user.id, targetType: 'USER', details: { role: dto.role } });
    return { ...user, role: dto.role };
  }

  async updateManagedUserRole(actor: AuthenticatedUser, userId: string, requestedRole: 'USER' | 'ADMIN' | 'OWNER') {
    this.requireDatabase();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, userRoles: { select: { role: { select: { name: true } } } } } });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.requireRole(requestedRole as UserRoleType);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.create({ data: { userId, roleId: role.id } }),
      // A changed role takes effect immediately, rather than waiting for an old session to expire.
      this.prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    await this.auditService.log({ actorId: actor.id, actorEmail: actor.email, action: 'MANAGED_USER_ROLE_CHANGED', targetId: userId, targetType: 'USER', details: { from: user.userRoles.map(item => item.role.name), to: requestedRole } });
    return { id: userId, email: user.email, role: requestedRole };
  }

  private requireDatabase() {
    if (!this.prisma.isConnected) throw new NotFoundException('Database is unavailable');
  }

  private async requireRole(name: UserRoleType) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new NotFoundException(`Role ${name} is not configured; run the database migration and seed command.`);
    return role;
  }
}
