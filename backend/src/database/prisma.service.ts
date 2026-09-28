import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');
  public isConnected = false;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Connected to PostgreSQL database via Prisma');
    } catch (error: any) {
      this.isConnected = false;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(`PostgreSQL connection failed: ${error?.message || 'Check DATABASE_URL'}`);
        throw error;
      }
      this.logger.warn(`PostgreSQL not connected (${error?.message || 'Check DATABASE_URL'}). Memory mode is development-only.`);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
