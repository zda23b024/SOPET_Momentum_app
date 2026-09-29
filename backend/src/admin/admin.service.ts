import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CryptoUtil } from '../common/utils/crypto.util';
import { CreateManagedUserDto } from './dto/managed-user.dto';
import { ConflictException, BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { UserRoleType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ChangeUserRoleDto } from './dto/admin.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly limiter: RateLimitService,
    private readonly auth: AuthService,
  ) {}

  private requireDatabase() {
    if (!this.prisma.isConnected) throw new ServiceUnavailableException('Administration requires the persistent data service');
  }

  async getOverview() {
    this.requireDatabase();
    const [activeUsers, pendingVerification, pendingDeletions, activeAdmins, recentSecurityEvents] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isEmailVerified: false } }),
      this.prisma.accountDeletionRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { isActive: true, userRoles: { some: { role: { name: { not: UserRoleType.USER } } } } } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);
    return { activeUsers, pendingVerification, pendingDeletions, activeAdmins, recentSecurityEvents, lockedAccounts: null, health: await this.getHealth() };
  }

  async getUsers(search?: string, role?: string, status?: string) {
    this.requireDatabase();
    const term = search?.trim().slice(0, 100);
    if (role && !Object.values(UserRoleType).includes(role as UserRoleType)) throw new BadRequestException('Unknown role filter');
    if (status && !['active', 'inactive', 'unverified'].includes(status)) throw new BadRequestException('Unknown status filter');
    return this.prisma.user.findMany({
      where: {
        ...(term ? { OR: [{ email: { contains: term, mode: 'insensitive' as const } }, { fullName: { contains: term, mode: 'insensitive' as const } }] } : {}),
        ...(role ? { userRoles: { some: { role: { name: role as UserRoleType } } } } : {}),
        ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : status === 'unverified' ? { isEmailVerified: false } : {}),
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, fullName: true, isActive: true, isEmailVerified: true, mfaEnabled: true, createdAt: true, lastLoginAt: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
  }

  async getRoles() {
    this.requireDatabase();
    return this.prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { code: true, description: true } } } } } });
  }

  async setAccountStatus(actorId: string, userId: string, isActive: boolean) {
    this.requireDatabase();
    if (actorId === userId) throw new ForbiddenException('You cannot change your own account status');
    await this.prisma.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(87420932)');
      const user = await transaction.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, userRoles: { select: { role: { select: { name: true } } } } } });
      if (!user) throw new NotFoundException('Account not found');
      if (!isActive && user.isActive && user.userRoles.some(item => item.role.name === UserRoleType.OWNER)) {
        const owners = await transaction.user.count({ where: { isActive: true, userRoles: { some: { role: { name: UserRoleType.OWNER } } } } });
        if (owners <= 1) throw new ForbiddenException('The last active system owner cannot be deactivated');
      }
      await transaction.user.update({ where: { id: userId }, data: { isActive } });
      if (!isActive) await transaction.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    });
    await this.auditService.log({ actorId, action: isActive ? 'ADMIN_ACCOUNT_ACTIVATED' : 'ADMIN_ACCOUNT_DEACTIVATED', targetId: userId, targetType: 'USER' });
    return { success: true };
  }

  async changeUserRole(actorId: string, userId: string, dto: ChangeUserRoleDto) {
    this.requireDatabase();
    if (actorId === userId) throw new ForbiddenException('You cannot change your own roles');
    const role = await this.prisma.role.findUnique({ where: { name: dto.role }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');
    await this.prisma.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SELECT pg_advisory_xact_lock(87420932)');
      const user = await transaction.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, userRoles: { select: { role: { select: { name: true } } } } } });
      if (!user) throw new NotFoundException('Account not found');
      if (dto.action === 'revoke' && dto.role === UserRoleType.OWNER && user.isActive && user.userRoles.some(item => item.role.name === UserRoleType.OWNER)) {
        const owners = await transaction.user.count({ where: { isActive: true, userRoles: { some: { role: { name: UserRoleType.OWNER } } } } });
        if (owners <= 1) throw new ForbiddenException('The last active system owner cannot be demoted');
      }
      if (dto.action === 'assign') {
        await transaction.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
      } else {
        await transaction.userRole.deleteMany({ where: { userId, roleId: role.id } });
      }
      await transaction.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    });
    await this.auditService.log({ actorId, action: dto.action === 'assign' ? 'ADMIN_ROLE_ASSIGNED' : 'ADMIN_ROLE_REVOKED', targetId: userId, targetType: 'USER', details: { role: dto.role } });
    return { success: true };
  }

  async revokeUserSessions(actorId: string, userId: string) {
    this.requireDatabase();
    const result = await this.prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    await this.auditService.log({ actorId, action: 'ADMIN_SESSIONS_REVOKED', targetId: userId, targetType: 'USER', details: { count: result.count } });
    return { revoked: result.count };
  }

  async resendUserVerification(actorId: string, userId: string) {
    this.requireDatabase();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true, isEmailVerified: true } });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.isActive || user.isEmailVerified) throw new BadRequestException('Account is not awaiting verification');
    await this.auth.resendVerification(user.email);
    await this.auditService.log({ actorId, action: 'ADMIN_VERIFICATION_RESENT', targetId: userId, targetType: 'USER' });
    return { success: true };
  }

  async requestUserPasswordReset(actorId: string, userId: string) {
    this.requireDatabase();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.isActive) throw new BadRequestException('Account is inactive');
    await this.auth.forgotPassword(user.email);
    await this.auditService.log({ actorId, action: 'ADMIN_PASSWORD_RESET_REQUESTED', targetId: userId, targetType: 'USER' });
    return { success: true };
  }

  async getPendingDeletions() {
    this.requireDatabase();
    return this.prisma.accountDeletionRequest.findMany({ where: { status: 'PENDING' }, take: 50, orderBy: { scheduledFor: 'asc' }, select: { id: true, userId: true, requestedAt: true, scheduledFor: true, status: true, user: { select: { email: true } } } });
  }

  async getHealth() {
    this.requireDatabase();
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected');
    const redis = await this.limiter.inspectRedis();
    return { database, redis, emailProvider: process.env.EMAIL_PROVIDER === 'resend' ? 'configured (delivery not verified)' : 'development or unavailable', version: '1.0.0', migrations: 'not verified by this endpoint', timestamp: new Date().toISOString() };
  }

  async getSystemMetrics() {
    this.requireDatabase();
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

  async getRecentAuditLogs(limit = 50) {
    this.requireDatabase();
    return this.prisma.auditLog.findMany({ take: Math.min(Math.max(limit, 1), 100), orderBy: { createdAt: 'desc' }, select: { id: true, actorId: true, actorEmail: true, action: true, targetId: true, targetType: true, result: true, createdAt: true } });
  }

  async getRecentSecurityEvents(limit = 50) {
    this.requireDatabase();
    return this.prisma.securityEvent.findMany({ take: Math.min(Math.max(limit, 1), 100), orderBy: { createdAt: 'desc' }, select: { id: true, userId: true, eventType: true, severity: true, createdAt: true } });
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


  private async requireRole(name: UserRoleType) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new NotFoundException(`Role ${name} is not configured; run the database migration and seed command.`);
    return role;
  }
}
