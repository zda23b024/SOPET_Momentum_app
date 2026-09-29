import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SecurityService } from '../security/security.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRoleType, PrivacyMode, AuthActionTokenType } from '@prisma/client';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  // In-memory fallback store for dev environment when Postgres isn't running
  private memoryUsers = new Map<string, any>();
  private memorySessions = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
    private readonly emailService: EmailService,
  ) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_MEMORY_USERS === 'true') void this.initDemoMemoryUsers();
  }

  private async initDemoMemoryUsers() {
    const demoPassword = process.env.DEV_MEMORY_USER_PASSWORD;
    if (!demoPassword || demoPassword.length < 12) {
      this.logger.warn('Development memory users are disabled until DEV_MEMORY_USER_PASSWORD is set to at least 12 characters.');
      return;
    }
    const hashed = await CryptoUtil.hashPassword(demoPassword);
    const users = [
      {
        id: 'usr-amina-demo',
        email: 'amina@example.com',
        passwordHash: hashed,
        fullName: 'Amina (Pilot Participant)',
        roles: ['USER'],
        permissions: ['goal.read_own', 'goal.create', 'goal.update_own', 'action.read_own', 'action.create', 'barrier.read_own'],
        privacyMode: 'STANDARD_PRIVATE',
        isActive: true,
      },
      {
        id: 'usr-support-demo',
        email: 'support@sopet.local',
        passwordHash: hashed,
        fullName: 'SOPET Support Specialist',
        roles: ['ADMIN'],
        permissions: ['account.metadata.view', 'security.sessions.view', 'admin.metrics.view'],
        privacyMode: 'STANDARD_PRIVATE',
        isActive: true,
      },
      {
        id: 'usr-security-demo',
        email: 'security@sopet.local',
        passwordHash: hashed,
        fullName: 'SOPET Security Lead',
        roles: ['ADMIN'],
        permissions: ['security.sessions.view', 'security.sessions.revoke', 'security.events.view', 'admin.metrics.view'],
        privacyMode: 'STANDARD_PRIVATE',
        isActive: true,
      },
      {
        id: 'usr-owner-demo',
        email: 'owner@sopet.local',
        passwordHash: hashed,
        fullName: 'SOPET System Owner',
        roles: ['OWNER'],
        permissions: ['*'],
        privacyMode: 'STANDARD_PRIVATE',
        isActive: true,
      },
    ];
    for (const u of users) {
      this.memoryUsers.set(u.email.toLowerCase(), u);
    }
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.toLowerCase().trim();

    // Check existing
    if (this.prisma.isConnected) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException('An account with this email already exists');
      }
    } else if (this.memoryUsers.has(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await CryptoUtil.hashPassword(dto.password);
    const userId = 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const privacyMode = (dto.privacyMode || 'STANDARD_PRIVATE') as PrivacyMode;

    let createdUser: any;

    if (this.prisma.isConnected) {
      const userRole = await this.prisma.role.findUnique({ where: { name: UserRoleType.USER } });
      try {
        createdUser = await this.prisma.user.create({
          data: {
            id: userId,
            email,
            passwordHash,
            fullName: dto.fullName || 'SOPET Participant',
            defaultPrivacyMode: privacyMode,
            isActive: true,
            profile: {
              create: {
                displayName: dto.fullName || 'SOPET Participant',
              },
            },
            userRoles: userRole ? { create: { roleId: userRole.id } } : undefined,
            notificationPref: {
              create: {},
            },
          },
          include: {
            userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') throw new ConflictException('An account with this email already exists');
        throw error;
      }
    } else {
      createdUser = {
        id: userId,
        email,
        passwordHash,
        fullName: dto.fullName || 'SOPET Participant',
        privacyMode,
        roles: ['USER'],
        permissions: ['goal.read_own', 'goal.create', 'goal.update_own', 'action.read_own', 'action.create'],
        isActive: true,
      };
      this.memoryUsers.set(email, createdUser);
    }

    await this.auditService.log({
      actorId: userId,
      actorEmail: email,
      action: 'USER_REGISTERED',
      targetId: userId,
      targetType: 'USER',
      ipAddress,
      userAgent,
      result: 'SUCCESS',
    });

    if (this.prisma.isConnected) {
      const verificationToken = await this.issueActionToken(createdUser.id, AuthActionTokenType.EMAIL_VERIFICATION, 24 * 60 * 60 * 1000);
      let verificationUrl: string | undefined;
      let verificationEmailStatus: 'SENT' | 'FAILED' | 'LOCAL_LINK' = 'SENT';
      try {
        verificationUrl = await this.emailService.sendVerification(email, verificationToken);
        if (verificationUrl) verificationEmailStatus = 'LOCAL_LINK';
      } catch {
        verificationEmailStatus = 'FAILED';
        await this.recordVerificationDeliveryFailure(createdUser.id, email, 'registration');
      }
      const tokens = this.prisma.isConnected ? {} : await this.generateTokens(createdUser, ipAddress, userAgent);
      return {
        verificationRequired: true,
        verificationPending: true,
        verificationEmailStatus,
        verificationUrl,
        user: { id: createdUser.id, email: createdUser.email, fullName: createdUser.fullName, roles: createdUser.roles || ['USER'], privacyMode: createdUser.defaultPrivacyMode },
        ...tokens,
      };
    }

    const tokens = this.prisma.isConnected ? {} : await this.generateTokens(createdUser, ipAddress, userAgent);
    return {
      verificationRequired: this.prisma.isConnected,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
        roles: createdUser.roles || ['USER'],
        privacyMode: createdUser.defaultPrivacyMode,
      },
      ...tokens,
    };
  }

  private async issueActionToken(userId: string, type: AuthActionTokenType, ttlMs: number) {
    const rawToken = CryptoUtil.generateSecureToken(32);
    await this.prisma.$transaction([
      this.prisma.authActionToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authActionToken.create({ data: { userId, type, tokenHash: CryptoUtil.hashToken(rawToken), expiresAt: new Date(Date.now() + ttlMs) } }),
    ]);
    return rawToken;
  }

  private limited(key: string, limit: number, windowMs: number) {
    const blocked = this.securityService.isRateLimited(key, limit, windowMs);
    this.securityService.recordFailedLogin(key);
    return blocked;
  }

  async verifyEmail(rawToken: string, ipAddress?: string, userAgent?: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const token = await this.prisma.authActionToken.findUnique({ where: { tokenHash: CryptoUtil.hashToken(rawToken) } });
    if (!token || token.type !== AuthActionTokenType.EMAIL_VERIFICATION || token.usedAt || token.expiresAt <= new Date()) throw new BadRequestException('Verification link is invalid or expired');
    await this.prisma.$transaction(async tx => {
      const consumed = await tx.authActionToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!consumed.count) throw new BadRequestException('Verification link is invalid or expired');
      await tx.user.update({ where: { id: token.userId }, data: { isEmailVerified: true } });
    });
    await this.auditService.log({ actorId: token.userId, action: 'EMAIL_VERIFIED', targetId: token.userId, targetType: 'USER', ipAddress, userAgent });
    return { success: true, message: 'Email verified successfully' };
  }

  async resendVerification(emailInput: string, ipAddress?: string) {
    const email = emailInput.toLowerCase().trim();
    const key = `verify-resend:${CryptoUtil.hashToken(`${email}:${ipAddress ?? ''}`)}`;
    if (!this.limited(key, 3, 15 * 60 * 1000) && this.prisma.isConnected) {
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, isEmailVerified: true } });
      if (user?.isActive && !user.isEmailVerified) {
        const verificationToken = await this.issueActionToken(user.id, AuthActionTokenType.EMAIL_VERIFICATION, 24 * 60 * 60 * 1000);
        try {
          const verificationUrl = await this.emailService.sendVerification(user.email, verificationToken);
          return { success: true, message: 'If the account can be verified, an email will be sent.', verificationPending: true, verificationEmailStatus: verificationUrl ? 'LOCAL_LINK' : 'SENT', verificationUrl };
        } catch {
          await this.recordVerificationDeliveryFailure(user.id, user.email, 'resend');
          return { success: true, message: 'Your account is still pending verification. We could not deliver the email yet; please try again later.', verificationPending: true, verificationEmailStatus: 'FAILED' };
        }
      }
    }
    return { success: true, message: 'If the account can be verified, an email will be sent.' };
  }

  private async recordVerificationDeliveryFailure(userId: string, email: string, source: 'registration' | 'resend') {
    try {
      await this.auditService.log({
        actorId: userId,
        actorEmail: email,
        action: 'EMAIL_VERIFICATION_DELIVERY_FAILED',
        targetId: userId,
        targetType: 'USER',
        result: 'FAILURE',
        reason: 'Email provider delivery failed',
        details: { source },
      });
    } catch {
      this.logger.warn('Could not persist email verification delivery failure audit event');
    }
  }

  async forgotPassword(emailInput: string, ipAddress?: string) {
    const email = emailInput.toLowerCase().trim();
    const key = `password-forgot:${CryptoUtil.hashToken(`${email}:${ipAddress ?? ''}`)}`;
    if (!this.limited(key, 3, 15 * 60 * 1000) && this.prisma.isConnected) {
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } });
      if (user?.isActive) await this.emailService.sendPasswordReset(user.email, await this.issueActionToken(user.id, AuthActionTokenType.PASSWORD_RESET, 30 * 60 * 1000));
    }
    return { success: true, message: 'If an eligible account exists, password reset instructions will be sent.' };
  }

  async resetPassword(rawToken: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const tokenHash = CryptoUtil.hashToken(rawToken);
    if (this.limited(`password-reset:${tokenHash}:${ipAddress ?? ''}`, 5, 15 * 60 * 1000)) throw new BadRequestException('Reset request cannot be completed');
    const token = await this.prisma.authActionToken.findUnique({ where: { tokenHash }, include: { user: { select: { email: true } } } });
    if (!token || token.type !== AuthActionTokenType.PASSWORD_RESET || token.usedAt || token.expiresAt <= new Date()) throw new BadRequestException('Reset link is invalid or expired');
    const passwordHash = await CryptoUtil.hashPassword(newPassword);
    await this.prisma.$transaction(async tx => {
      const consumed = await tx.authActionToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!consumed.count) throw new BadRequestException('Reset link is invalid or expired');
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
      await tx.authActionToken.updateMany({ where: { userId: token.userId, type: AuthActionTokenType.PASSWORD_RESET, usedAt: null }, data: { usedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: token.userId, isRevoked: false }, data: { isRevoked: true } });
    });
    await this.securityService.recordSecurityEvent({ userId: token.userId, eventType: 'PASSWORD_RESET_COMPLETED', severity: 'MEDIUM', ipAddress, userAgent });
    await this.auditService.log({ actorId: token.userId, action: 'PASSWORD_RESET_COMPLETED', targetId: token.userId, targetType: 'USER', ipAddress, userAgent });
    await this.emailService.sendPasswordChanged(token.user.email);
    return { success: true, message: 'Password reset successfully' };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.toLowerCase().trim();

    // Brute-force rate check
    if (this.securityService.isRateLimited(`login:${email}`, 5, 300000)) {
      await this.securityService.recordSecurityEvent({
        eventType: 'BRUTE_FORCE_SUSPECTED',
        severity: 'HIGH',
        ipAddress,
        userAgent,
        details: { email },
      });
      throw new BadRequestException('Too many failed login attempts. Please wait 5 minutes before retrying.');
    }

    let user: any;
    if (this.prisma.isConnected) {
      user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } else {
      user = this.memoryUsers.get(email);
    }

    if (!user || !user.isActive) {
      this.securityService.recordFailedLogin(`login:${email}`);
      await this.auditService.log({
        actorEmail: email,
        action: 'USER_LOGIN_FAILED',
        reason: 'User not found or inactive',
        ipAddress,
        userAgent,
        result: 'FAILURE',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await CryptoUtil.verifyPassword(user.passwordHash, dto.password);
    if (!isValid) {
      const attempts = this.securityService.recordFailedLogin(`login:${email}`);
      await this.securityService.recordSecurityEvent({
        userId: user.id,
        eventType: 'FAILED_LOGIN',
        severity: attempts >= 3 ? 'MEDIUM' : 'LOW',
        ipAddress,
        userAgent,
      });
      await this.auditService.log({
        actorId: user.id,
        actorEmail: email,
        action: 'USER_LOGIN_FAILED',
        reason: 'Incorrect password',
        ipAddress,
        userAgent,
        result: 'FAILURE',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.prisma.isConnected && !user.isEmailVerified) {
      throw new UnauthorizedException('Email verification is required before sign in');
    }

    // MFA Verification if enabled
    if (user.mfaEnabled) {
      if (!dto.totpCode && !dto.recoveryCode) {
        return {
          mfaRequired: true,
          tempSessionId: user.id,
        };
      }
      const validTotp = dto.totpCode ? CryptoUtil.verifyTotp(user.mfaSecret, dto.totpCode) : false;
      const recoveryHash = dto.recoveryCode ? CryptoUtil.hashToken(dto.recoveryCode) : undefined;
      const validRecovery = recoveryHash && user.mfaRecoveryCodes.includes(recoveryHash);
      if (!validTotp && !validRecovery) {
        throw new UnauthorizedException('Invalid MFA authentication code');
      }
      if (validRecovery && this.prisma.isConnected) {
        await this.prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: { set: user.mfaRecoveryCodes.filter((code: string) => code !== recoveryHash) } } });
      }
    }

    this.securityService.clearFailedLogins(`login:${email}`);

    // Update lastLoginAt
    if (this.prisma.isConnected) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const roles = user.roles || user.userRoles?.map((ur: any) => ur.role.name) || ['USER'];
    const permissions =
      user.permissions ||
      user.userRoles?.flatMap((ur: any) => ur.role.permissions.map((p: any) => p.permission.code)) ||
      [];

    const tokens = await this.generateTokens(
      {
        id: user.id,
        email: user.email,
        roles,
        permissions,
        privacyMode: user.defaultPrivacyMode,
      },
      ipAddress,
      userAgent,
    );

    await this.auditService.log({
      actorId: user.id,
      actorEmail: email,
      action: 'USER_LOGGED_IN',
      targetId: user.id,
      targetType: 'USER',
      ipAddress,
      userAgent,
      result: 'SUCCESS',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions,
        privacyMode: user.defaultPrivacyMode,
      },
      ...tokens,
    };
  }

  async beginMfaEnrollment(userId: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabled: true } });
    if (!existing || existing.mfaEnabled) throw new BadRequestException('MFA is already enabled or the account is unavailable');
    const secret = CryptoUtil.generateTotpSecret();
    const updated = await this.prisma.user.updateMany({ where: { id: userId, mfaEnabled: false }, data: { mfaSecret: secret } });
    if (!updated.count) throw new BadRequestException('MFA is already enabled or the account is unavailable');
    return { secret, issuer: 'SOPET Momentum' };
  }

  async confirmMfaEnrollment(userId: string, code: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    if (!user?.mfaSecret || !CryptoUtil.verifyTotp(user.mfaSecret, code)) throw new UnauthorizedException('Invalid MFA authentication code');
    const recoveryCodes = Array.from({ length: 8 }, () => CryptoUtil.generateSecureToken(6));
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true, mfaRecoveryCodes: recoveryCodes.map(codeValue => CryptoUtil.hashToken(codeValue)) } });
    return { recoveryCodes };
  }

  private async verifyMfaManagement(userId: string, dto: { currentPassword: string; totpCode?: string; recoveryCode?: string }) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new BadRequestException('MFA is not enabled');
    const passwordValid = await CryptoUtil.verifyPassword(user.passwordHash, dto.currentPassword);
    const totpValid = dto.totpCode ? CryptoUtil.verifyTotp(user.mfaSecret, dto.totpCode) : false;
    const recoveryValid = dto.recoveryCode ? user.mfaRecoveryCodes.includes(CryptoUtil.hashToken(dto.recoveryCode)) : false;
    if (!passwordValid || (!totpValid && !recoveryValid)) throw new UnauthorizedException('Account verification failed');
  }

  async regenerateMfaRecoveryCodes(userId: string, dto: { currentPassword: string; totpCode?: string; recoveryCode?: string }) {
    await this.verifyMfaManagement(userId, dto);
    const recoveryCodes = Array.from({ length: 8 }, () => CryptoUtil.generateSecureToken(6));
    await this.prisma.user.update({ where: { id: userId }, data: { mfaRecoveryCodes: recoveryCodes.map(code => CryptoUtil.hashToken(code)) } });
    await this.auditService.log({ actorId: userId, action: 'MFA_RECOVERY_CODES_REGENERATED', targetId: userId, targetType: 'USER' });
    return { recoveryCodes };
  }

  async disableMfa(userId: string, dto: { currentPassword: string; totpCode?: string; recoveryCode?: string }) {
    await this.verifyMfaManagement(userId, dto);
    await this.prisma.$transaction(async transaction => {
      await transaction.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] } });
      await transaction.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
    });
    await this.auditService.log({ actorId: userId, action: 'MFA_DISABLED', targetId: userId, targetType: 'USER' });
    return { success: true };
  }

  async refreshToken(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const hashedIncoming = CryptoUtil.hashToken(rawRefreshToken);
    const sessionId = payload.sessionId;

    if (this.prisma.isConnected && sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            include: {
              userRoles: {
                include: { role: { include: { permissions: { include: { permission: true } } } } },
              },
            },
          },
        },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        await this.securityService.recordSecurityEvent({
          userId: payload.sub,
          eventType: 'REVOKED_SESSION_REFRESH_ATTEMPT',
          severity: 'HIGH',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Session expired or revoked');
      }

      // Refresh token rotation check: if stored hash doesn't match, reuse is detected!
      if (session.refreshTokenHash !== hashedIncoming) {
        // Invalidate entire session family for security
        await this.prisma.session.update({
          where: { id: session.id },
          data: { isRevoked: true },
        });
        await this.securityService.recordSecurityEvent({
          userId: session.userId,
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
          severity: 'CRITICAL',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Security violation: token reuse detected');
      }

      // Rotate token: update session with new refresh token hash
      const newRefreshToken = CryptoUtil.generateSecureToken(48);
      const newHash = CryptoUtil.hashToken(newRefreshToken);

      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: newHash,
          lastActiveAt: new Date(),
        },
      });

      const roles = session.user.userRoles?.map((ur: any) => ur.role.name) || ['USER'];
      const permissions =
        session.user.userRoles?.flatMap((ur: any) => ur.role.permissions.map((p: any) => p.permission.code)) || [];

      const newAccessToken = this.jwtService.sign(
        {
          sub: session.user.id,
          email: session.user.email,
          roles,
          permissions,
          sessionId: session.id,
          privacyMode: session.user.defaultPrivacyMode,
        },
        {
          secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
          expiresIn: (this.configService.get<string>('jwt.accessTtl') || '15m') as any,
        },
      );

      const signedRefreshToken = this.jwtService.sign(
        { sub: session.user.id, sessionId: session.id },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: (this.configService.get<string>('jwt.refreshTtl') || '7d') as any,
        },
      );

      return {
        accessToken: newAccessToken,
        refreshToken: signedRefreshToken,
      };
    } else {
      // Memory fallback rotation
      const newAccessToken = this.jwtService.sign(
        {
          sub: payload.sub,
          email: payload.email || 'amina@example.com',
          roles: payload.roles || ['USER'],
          permissions: payload.permissions || [],
          sessionId,
        },
        {
          secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
          expiresIn: '15m',
        },
      );
      const signedRefreshToken = this.jwtService.sign(
        { sub: payload.sub, sessionId },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: '7d',
        },
      );
      return {
        accessToken: newAccessToken,
        refreshToken: signedRefreshToken,
      };
    }
  }

  async logout(sessionId?: string, userId?: string) {
    if (sessionId && this.prisma.isConnected) {
      await this.prisma.session.updateMany({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
    }
    if (userId) {
      await this.auditService.log({
        actorId: userId,
        action: 'USER_LOGOUT',
        targetId: sessionId,
        targetType: 'SESSION',
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAllSessions(userId: string) {
    if (this.prisma.isConnected) {
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
    await this.auditService.log({
      actorId: userId,
      action: 'ALL_SESSIONS_REVOKED',
      targetId: userId,
      targetType: 'USER',
    });
    return { success: true, message: 'All active sessions have been revoked' };
  }

  private async generateTokens(user: any, ipAddress?: string, userAgent?: string) {
    const sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const rawRefreshToken = CryptoUtil.generateSecureToken(48);
    const hashedToken = CryptoUtil.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    if (this.prisma.isConnected) {
      await this.prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: hashedToken,
          userAgent,
          ipAddress,
          expiresAt,
        },
      });
    } else {
      this.memorySessions.set(sessionId, {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashedToken,
        userAgent,
        ipAddress,
        expiresAt,
        isRevoked: false,
      });
    }

    const payload: any = {
      sub: user.id,
      email: user.email,
      roles: user.roles || ['USER'],
      permissions: user.permissions || [],
      sessionId,
      privacyMode: user.defaultPrivacyMode || 'STANDARD_PRIVATE',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: (this.configService.get<string>('jwt.accessTtl') || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: (this.configService.get<string>('jwt.refreshTtl') || '7d') as any,
      },
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: 900, // 15 mins
    };
  }
}
