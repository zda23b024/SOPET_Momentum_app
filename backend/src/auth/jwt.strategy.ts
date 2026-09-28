import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  privacyMode?: string;
}

export const cookieAccessTokenExtractor = (req: { cookies?: Record<string, string> }) => req?.cookies?.['accessToken'] || null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieAccessTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!this.prisma.isConnected && payload.roles?.some(role => role !== 'USER')) {
      throw new UnauthorizedException('Administrative sessions require the persistent data service');
    }
    if (this.prisma.isConnected && payload.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired or revoked');
      }
    }

    if (this.prisma.isConnected) {
      const account = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, isActive: true, mfaEnabled: true, defaultPrivacyMode: true, userRoles: { select: { role: { select: { name: true, permissions: { select: { permission: { select: { code: true } } } } } } } } },
      });
      if (!account?.isActive) throw new UnauthorizedException('Account is inactive');
      return {
        id: payload.sub,
        email: account.email,
        roles: account.userRoles.map(item => item.role.name),
        permissions: [...new Set(account.userRoles.flatMap(item => item.role.permissions.map(grant => grant.permission.code)))],
        sessionId: payload.sessionId,
        privacyMode: account.defaultPrivacyMode,
        mfaEnabled: account.mfaEnabled,
      };
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || ['USER'],
      permissions: payload.permissions || [],
      sessionId: payload.sessionId,
      privacyMode: payload.privacyMode || 'STANDARD_PRIVATE',
      mfaEnabled: false,
    };
  }
}
