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

    // Check if session is revoked if DB is connected
    if (this.prisma.isConnected && payload.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired or revoked');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || ['USER'],
      permissions: payload.permissions || [],
      sessionId: payload.sessionId,
      privacyMode: payload.privacyMode || 'STANDARD_PRIVATE',
    };
  }
}
