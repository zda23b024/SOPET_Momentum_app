import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

import { SaveVaultMetadataDto } from './dto/vault.dto';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async registerKeyMetadata(userId: string, dto: SaveVaultMetadataDto) {
    if (!this.prisma.isConnected) throw new Error('DATABASE_UNAVAILABLE');
    await this.prisma.encryptionKeyMetadata.upsert({
      where: { userId_keyVersion: { userId, keyVersion: dto.keyVersion } },
      create: { userId, ...dto, recoveryConfigured: true },
      update: { ...dto, recoveryConfigured: true },
    });

    await this.auditService.log({
      actorId: userId,
      action: 'CLIENT_ENCRYPTION_KEY_REGISTERED',
      details: { keyId: dto.keyId, algorithm: dto.algorithm },
    });

    return { success: true, keyId: dto.keyId };
  }

  async getKeyMetadata(userId: string) {
    if (!this.prisma.isConnected) throw new Error('DATABASE_UNAVAILABLE');
      const record = await this.prisma.encryptionKeyMetadata.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) return null;
      const { userId: _owner, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, recoveryConfigured: _configured, ...metadata } = record;
      return metadata;
  }
}
