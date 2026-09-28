import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GeminiProvider } from './gemini.provider';
import { PromptVersionService } from './prompt-version.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { AiSafetyService } from './ai-safety.service';
import { AiInteractionAuditService } from './ai-interaction-audit.service';
import {
  BarrierDiagnosisRequest,
  MmaGenerationRequest,
  RestartGuidanceRequest,
  SharpenNmaRequest,
} from './ai.interface';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AiService {
  constructor(
    private readonly provider: GeminiProvider,
    private readonly promptService: PromptVersionService,
    private readonly retrievalService: KnowledgeRetrievalService,
    private readonly safetyService: AiSafetyService,
    private readonly auditService: AiInteractionAuditService,
    private readonly prisma: PrismaService,
  ) {}

  private async authorize(
    req: { goalId?: string; privacyMode?: string; consent?: boolean; purpose?: string; fieldsShared?: string[]; consentInteractionId?: string },
    userId: string | undefined,
    transmittedFields: string[],
  ) {
    let privacyMode = req.privacyMode ?? 'STANDARD_PRIVATE';
    if (req.goalId) {
      if (!userId || !this.prisma.isConnected) throw new ForbiddenException({ code: 'GOAL_ACCESS_DENIED' });
      const goal = await this.prisma.goal.findFirst({ where: { id: req.goalId, userId }, select: { privacyMode: true } });
      if (!goal) throw new ForbiddenException({ code: 'GOAL_ACCESS_DENIED' });
      privacyMode = goal.privacyMode;
    }
    if (privacyMode !== 'STANDARD_PRIVATE') {
      const declared = new Set(req.fieldsShared ?? []);
      const valid = req.consent === true && Boolean(req.purpose?.trim()) && Boolean(req.consentInteractionId) &&
        transmittedFields.every(field => declared.has(field));
      if (!valid || !userId) {
        throw new ForbiddenException({ code: 'AI_CONSENT_REQUIRED', message: 'Valid per-interaction consent is required.' });
      }
      if (this.prisma.isConnected) {
        try {
          await this.prisma.aIConsentReceipt.create({ data: {
            id: req.consentInteractionId!, userId, goalId: req.goalId, purpose: req.purpose!, fieldsShared: req.fieldsShared!,
          } });
        } catch {
          throw new ForbiddenException({ code: 'AI_CONSENT_ALREADY_USED', message: 'Consent cannot be reused.' });
        }
      }
    }
    return privacyMode;
  }

  async diagnoseBarrier(req: BarrierDiagnosisRequest, userId?: string) {
    const privacyMode = await this.authorize(req, userId, ['actionTitle', 'userExplanation', ...(req.actionDescription ? ['actionDescription'] : []), ...(req.readinessAnswers ? ['readinessAnswers'] : [])]);
    // 1. Safety Check
    const safetyCheck = this.safetyService.validateInputSafety(req.userExplanation);
    if (safetyCheck.isCrisis) {
      throw new BadRequestException({
        code: 'SAFETY_DEFLECTION',
        message: safetyCheck.message,
      });
    }

    const start = Date.now();
    const systemPrompt = this.promptService.getBarrierDiagnosisSystemPrompt('1.0');
    const context = await this.retrievalService.getAcifContext();

    const response = await this.provider.diagnoseBarrier(systemPrompt, context, req);
    const latencyMs = Date.now() - start;

    // 2. Audit (respecting user's privacy mode)
    await this.auditService.recordInteraction({
      userId,
      useCase: 'BARRIER_DIAGNOSIS',
      modelName: 'gemini-2.5-flash',
      promptVersion: '1.0',
      goalId: req.goalId, consent: req.consent === true, fieldsShared: req.fieldsShared ?? [],
      latencyMs,
      privacyMode,
    });

    return {
      success: true,
      proposalType: 'BARRIER_DIAGNOSIS_PROPOSAL',
      ruleNotice: 'AI suggests, User confirms, App writes. You may accept, modify, or reject this category.',
      data: response,
    };
  }

  async suggestMma(req: MmaGenerationRequest, userId?: string) {
    const privacyMode = await this.authorize(req, userId, ['actionTitle', 'barrierCategoryCode', ...(req.userExplanation ? ['userExplanation'] : []), ...(req.targetMinutes ? ['targetMinutes'] : [])]);
    const start = Date.now();
    const systemPrompt = this.promptService.getMmaGenerationSystemPrompt('1.0');
    const context = await this.retrievalService.getAcifContext();

    const response = await this.provider.generateMma(systemPrompt, context, req);
    const latencyMs = Date.now() - start;

    await this.auditService.recordInteraction({
      userId,
      useCase: 'MMA_GENERATION',
      modelName: 'gemini-2.5-flash',
      promptVersion: '1.0',
      goalId: req.goalId, consent: req.consent === true, fieldsShared: req.fieldsShared ?? [],
      latencyMs,
      privacyMode,
    });

    return {
      success: true,
      proposalType: 'MMA_PROPOSAL',
      ruleNotice: 'Completing an MMA restores momentum; your parent action will remain active.',
      data: response,
    };
  }

  async suggestRestart(req: RestartGuidanceRequest, userId?: string) {
    const privacyMode = await this.authorize(req, userId, ['goalTitle', 'interruptionType', 'causeDescription', ...(req.daysElapsed ? ['daysElapsed'] : [])]);
    const start = Date.now();
    const systemPrompt = this.promptService.getRestartSystemPrompt('1.0');
    const context = await this.retrievalService.getAcifContext();

    const response = await this.provider.suggestRestart(systemPrompt, context, req);
    const latencyMs = Date.now() - start;

    await this.auditService.recordInteraction({
      userId,
      useCase: 'RESTART_GUIDANCE',
      modelName: 'gemini-2.5-flash',
      promptVersion: '1.0',
      goalId: req.goalId, consent: req.consent === true, fieldsShared: req.fieldsShared ?? [],
      latencyMs,
      privacyMode,
    });

    return {
      success: true,
      proposalType: 'RESTART_PROPOSAL',
      data: response,
    };
  }

  async sharpenNma(req: SharpenNmaRequest, userId?: string) {
    const privacyMode = await this.authorize(req, userId, ['draftTitle', 'goalTitle']);
    const start = Date.now();
    const systemPrompt = this.promptService.getNmaSharpeningSystemPrompt('1.0');
    const context = await this.retrievalService.getAcifContext();

    const response = await this.provider.sharpenNma(systemPrompt, context, req);
    const latencyMs = Date.now() - start;

    await this.auditService.recordInteraction({
      userId,
      useCase: 'NMA_SHARPENING',
      modelName: 'gemini-2.5-flash',
      promptVersion: '1.0',
      goalId: req.goalId, consent: req.consent === true, fieldsShared: req.fieldsShared ?? [],
      latencyMs,
      privacyMode,
    });

    return {
      success: true,
      proposalType: 'NMA_SHARPENING_PROPOSAL',
      data: response,
    };
  }
}
