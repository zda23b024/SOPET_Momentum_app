import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GoalsService } from '../goals/goals.service';
import { ActionsService } from '../actions/actions.service';
import { AuditService } from '../audit/audit.service';
import { RestartProtocolDto } from './dto/restart.dto';
import { ActionStatus, ContentEncoding, GoalStatus, Prisma, RestartDecision } from '@prisma/client';
import { PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';

@Injectable()
export class RestartService {
  private memoryRestarts = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly goalsService: GoalsService,
    private readonly actionsService: ActionsService,
    private readonly auditService: AuditService,
  ) {}

  async executeRestart(userId: string, goalId: string, dto: RestartProtocolDto) {
    const goal = await this.goalsService.getGoalById(userId, goalId);
    if (goal.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.restart);

    const interruptionId = 'intrp-' + Date.now();
    const restartId = 'rst-' + Date.now();

    if (this.prisma.isConnected) {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Record Interruption
        const interruption = await tx.interruption.create({
          data: {
            id: interruptionId,
            goalId,
            interruptionType: dto.interruptionType,
            causeDescription: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.causeDescription,
            contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
            encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
          },
        });

        // 2. Record 5-Question Restart Record
        const restart = await tx.restart.create({
          data: {
            id: restartId,
            interruptionId: interruption.id,
            isStillMeaningful: dto.isStillMeaningful,
            whatChanged: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.whatChanged,
            rootCause: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.rootCause,
            isPlanRealistic: dto.isPlanRealistic,
            restartDecision: dto.restartDecision,
            restartActionTitle: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.restartActionTitle,
            contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
            encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
            daysElapsed: dto.daysElapsed || 2.0,
          },
        });

        // 3. Reactivate goal if it was paused
        if (dto.restartDecision === RestartDecision.PAUSE_GOAL) {
          await tx.goal.update({ where: { id: goalId }, data: { status: GoalStatus.PAUSED } });
        } else if (dto.restartDecision === RestartDecision.STRATEGICALLY_DISCONTINUE) {
          await tx.goal.update({ where: { id: goalId }, data: { status: GoalStatus.DISCONTINUED } });
        } else if (goal.status === GoalStatus.PAUSED) {
          await tx.goal.update({
            where: { id: goalId },
            data: { status: GoalStatus.ACTIVE },
          });
        }

        // 4. Create immediate Restart Action and designate as active NMA
        const closesGoal = dto.restartDecision === RestartDecision.PAUSE_GOAL || dto.restartDecision === RestartDecision.STRATEGICALLY_DISCONTINUE;
        if (!closesGoal) await tx.action.updateMany({
          where: { goalId, isNMA: true },
          data: { isNMA: false },
        });

        const newNma = dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED || closesGoal ? null : await tx.action.create({
          data: {
            userId,
            goalId,
            title: dto.restartActionTitle,
            description: `Generated from Restart Protocol: ${dto.restartDecision}`,
            status: ActionStatus.PENDING,
            isNMA: true,
          },
        });

        await this.auditService.log({
          actorId: userId,
          action: 'GOAL_RESTARTED',
          targetId: goalId,
          targetType: 'GOAL',
          details: { decision: dto.restartDecision, daysElapsed: dto.daysElapsed },
        });

        return {
          interruption,
          restart,
          newAction: newNma,
        };
      });
    }

    const result = {
      id: restartId,
      goalId,
      decision: dto.restartDecision,
      restartActionTitle: dto.restartActionTitle,
      restartedAt: new Date(),
    };
    this.memoryRestarts.set(restartId, result);
    return result;
  }

  async getGoalRestarts(userId: string, goalId: string) {
    await this.goalsService.getGoalById(userId, goalId);

    if (this.prisma.isConnected) {
      return await this.prisma.interruption.findMany({
        where: { goalId },
        include: { restarts: true },
        orderBy: { startedAt: 'desc' },
      });
    }

    return Array.from(this.memoryRestarts.values()).filter((r) => r.goalId === goalId);
  }
}
