import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GoalsService } from '../goals/goals.service';

import { ContentEncoding, Prisma } from '@prisma/client';
import { CreateKpiDto, RecordKpiValueDto } from './dto/kpi.dto';
import { PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';

@Injectable()
export class KpiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goalsService: GoalsService,
  ) {}

  async list(userId: string) {
    if (!this.prisma.isConnected) return [];
    return this.prisma.kPI.findMany({ where: { goal: { userId } }, include: { values: { orderBy: { recordedAt: 'desc' } } }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, dto: CreateKpiDto) {
    const goal = await this.goalsService.getGoalById(userId, dto.goalId);
    if (goal.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.kpi);
    return this.prisma.kPI.create({ data: { goalId: dto.goalId, name: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.name, unit: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.unit, targetValue: dto.targetValue, currentValue: dto.currentValue ?? 0, contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT, encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue } });
  }

  async calculateUserMomentumKpis(userId: string) {
    if (this.prisma.isConnected) {
      const actions = await this.prisma.action.findMany({ where: { userId } });
      const completedActions = actions.filter((a) => a.status === 'COMPLETED').length;
      const totalActions = actions.length;

      const actionCompletionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

      const barriers = await this.prisma.barrier.findMany({
        where: { action: { userId } },
      });
      const resolvedBarriers = barriers.filter((b) => b.resolved).length;
      const barrierResolutionRate = barriers.length > 0 ? Math.round((resolvedBarriers / barriers.length) * 100) : 0;

      const reviews = await this.prisma.weeklyReview.findMany({ where: { userId } });
      const continuityWeeks = reviews.length;

      const restarts = await this.prisma.restart.findMany({
        where: { interruption: { goal: { userId } } },
      });
      const avgRestartDays = restarts.length > 0
        ? Number((restarts.reduce((acc, r) => acc + (r.daysElapsed || 2.0), 0) / restarts.length).toFixed(1))
        : 0;

      const milestones = await this.prisma.milestone.findMany({
        where: { goal: { userId } },
      });
      const completedMilestones = milestones.filter((m) => m.isCompleted).length;
      const milestoneProgress = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;

      return {
        actionCompletionRate,
        continuityWeeks,
        momentumContinuityWeeks: continuityWeeks,
        restartSpeedDays: avgRestartDays,
        barrierResolutionRate,
        goalMilestoneProgress: milestoneProgress,
        milestoneProgressPercent: milestoneProgress,
        selfEfficacyScore: 0,
        selfEfficacyTrend: 'Stable',
        totalActions,
        completedActions,
        inProgressActions: actions.filter((a) => a.status === 'IN_PROGRESS').length,
        blockedActions: actions.filter((a) => a.status === 'BLOCKED').length,
        totalBarriersDiagnosed: barriers.length,
        barriersResolved: resolvedBarriers,
        totalMilestones: milestones.length,
        completedMilestones,
      };
    }

    // Default prototype values
    return {
      actionCompletionRate: 75,
      continuityWeeks: 4,
      momentumContinuityWeeks: 4,
      restartSpeedDays: 1.8,
      barrierResolutionRate: 80,
      goalMilestoneProgress: 33,
      milestoneProgressPercent: 33,
      selfEfficacyScore: 4.2,
      selfEfficacyTrend: 'Increasing',
      totalActions: 12,
      completedActions: 9,
      inProgressActions: 2,
      blockedActions: 1,
      totalBarriersDiagnosed: 5,
      barriersResolved: 4,
      totalMilestones: 3,
      completedMilestones: 1,
    };
  }

  async recordKpiValue(userId: string, kpiId: string, dto: RecordKpiValueDto) {
    if (this.prisma.isConnected) {
      const kpi = await this.prisma.kPI.findUnique({
        where: { id: kpiId },
        include: { goal: true },
      });
      if (!kpi || kpi.goal.userId !== userId) {
        throw new NotFoundException('KPI not found or unauthorized');
      }
      if (kpi.goal.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
      validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.kpi);

      return await this.prisma.$transaction(async (tx) => {
        const val = await tx.kPIValue.create({
          data: {
            kpiId,
            value: dto.value,
            notes: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.notes,
            contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
            encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
          },
        });

        await tx.kPI.update({
          where: { id: kpiId },
          data: { currentValue: dto.value },
        });

        return val;
      });
    }

    return { id: 'kpival-' + Date.now(), kpiId, value: dto.value, recordedAt: new Date() };
  }
}
