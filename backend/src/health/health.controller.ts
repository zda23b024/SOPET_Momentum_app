import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../common/decorators/roles.decorator';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@ApiTags('Health & Status')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly limiter: RateLimitService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    let database: 'connected' | 'disconnected' = 'disconnected';
    if (this.prisma.isConnected) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        database = 'connected';
      } catch {
        database = 'disconnected';
      }
    }

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database,
      uptimeSeconds: process.uptime(),
      version: '1.0.0',
    };
  }

  @Public()
  @Get('live')
  live() { return { status: 'ok', timestamp: new Date().toISOString() }; }

  @Public()
  @Get('ready')
  async ready() {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redis = await this.limiter.ping().catch(() => false);
    if (!database || !redis) throw new ServiceUnavailableException({ status: 'not_ready', database: database ? 'connected' : 'disconnected', redis: redis ? 'connected' : 'disconnected' });
    return { status: 'ok', database: 'connected', redis: 'connected' };
  }
}
