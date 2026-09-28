import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface RecordAiAuditParams {
  userId?: string;
  useCase: string; // BARRIER_DIAGNOSIS, MMA_GENERATION, RESTART_GUIDANCE, NMA_SHARPENING
  modelName: string;
  promptVersion: string;
  goalId?: string;
  consent: boolean;
  fieldsShared: string[];
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  privacyMode?: string;
}

@Injectable()
export class AiInteractionAuditService {
  private readonly logger = new Logger('AiAudit');

  constructor(private readonly prisma: PrismaService) {}

  async recordInteraction(params: RecordAiAuditParams) {
    this.logger.log(
      `AI_AUDIT [${params.useCase}] User: ${params.userId || 'anon'} Model: ${params.modelName} Latency: ${params.latencyMs || 0}ms Privacy: ${params.privacyMode || 'STANDARD'}`,
    );

    if (this.prisma.isConnected) {
      try {
        await this.prisma.aIInteractionMetadata.create({
          data: {
            interactionType: params.useCase,
            provider: 'gemini',
            modelName: params.modelName,
            promptVersion: params.promptVersion,
            userId: params.userId,
            goalId: params.goalId,
            fieldsShared: params.fieldsShared,
            sanitizedTokens: (params.promptTokens || 0) + (params.completionTokens || 0),
            latencyMs: params.latencyMs || 0,
            userConsentGiven: params.consent,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to persist AI audit record: ${err?.message}`);
      }
    }
  }
}
