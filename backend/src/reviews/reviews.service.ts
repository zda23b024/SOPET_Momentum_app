import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GoalsService } from '../goals/goals.service';
import { ActionsService } from '../actions/actions.service';
import { AuditService } from '../audit/audit.service';
import { CreateWeeklyReviewDto } from './dto/reviews.dto';
import { ActionStatus, ContentEncoding, Prisma } from '@prisma/client';
import { PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';

@Injectable()
export class ReviewsService {
  private memoryReviews = new Map<string, any>();
  private memoryLessons = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly goalsService: GoalsService,
    private readonly actionsService: ActionsService,
    private readonly auditService: AuditService,
  ) {
    this.initDemoReviews();
  }

  private initDemoReviews() {
    this.memoryReviews.set('rev-amina-w1', {
      id: 'rev-amina-w1',
      userId: 'usr-amina-demo',
      goalId: 'goal-amina-primary',
      weekEndingDate: new Date('2026-09-14'),
      meaningfulProgress: 'Completed 3 office manager interviews and validated lunch price point at $16/person.',
      actionsThatMattered: 'Direct telephone calls rather than drafting email templates.',
      whatGotInTheWay: 'Impostor hesitation before the first cold call.',
      interventionsThatHelped: 'Evidence log and 10-minute MMA script review.',
      nextNmaTitle: 'Draft catering sample menu for validation feedback',
      createdAt: new Date('2026-09-14'),
    });
  }

  async getReviews(userId: string, goalId?: string) {
    if (this.prisma.isConnected) {
      return await this.prisma.weeklyReview.findMany({
        where: {
          userId,
          goalId: goalId || undefined,
        },
        include: {
          lessons: true,
          adjustments: true,
          goal: { select: { id: true, title: true } },
        },
        orderBy: { weekEndingDate: 'desc' },
      });
    }

    return Array.from(this.memoryReviews.values()).filter(
      (r) => r.userId === userId && (!goalId || r.goalId === goalId),
    );
  }

  async createWeeklyReview(userId: string, dto: CreateWeeklyReviewDto) {
    const goal = await this.goalsService.getGoalById(userId, dto.goalId);
    if (goal.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.review);

    const reviewId = 'rev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const weekEndingDate = dto.weekEndingDate ? new Date(dto.weekEndingDate) : new Date();

    if (this.prisma.isConnected) {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create Weekly Review
        const review = await tx.weeklyReview.create({
          data: {
            id: reviewId,
            userId,
            goalId: dto.goalId,
            weekEndingDate,
            meaningfulProgress: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.meaningfulProgress,
            actionsThatMattered: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.actionsThatMattered,
            whatGotInTheWay: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.whatGotInTheWay,
            interventionsThatHelped: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.interventionsThatHelped,
            interventionsThatDidNotHelp: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.interventionsThatDidNotHelp,
            interruptionExperienced: dto.interruptionExperienced ?? false,
            restartDetails: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.restartDetails,
            nextNmaTitle: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.nextNmaTitle,
            aiSummaryDraft: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.aiSummaryDraft,
            aiSummaryConfirmed: dto.aiSummaryConfirmed ?? false,
            isClientEncrypted: dto.isClientEncrypted ?? false,
            ciphertextPayload: dto.ciphertextPayload,
            encryptionMetadata: dto.encryptionMetadata,
            contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
            encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
          },
        });

        // 2. Create Lesson if provided
        if (dto.extractedLesson || (dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED && dto.encryptedPayload)) {
          await tx.lesson.create({
            data: {
              userId,
              goalId: dto.goalId,
              weeklyReviewId: review.id,
              lessonText: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.extractedLesson,
              adjustmentText: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.concreteAdjustment || 'Continue rhythm adjustment in upcoming week.',
              contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
              encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
            },
          });
        }

        // 3. Create Adjustment if provided
        if (dto.concreteAdjustment || (dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED && dto.encryptedPayload)) {
          await tx.adjustment.create({
            data: {
              weeklyReviewId: review.id,
              description: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.concreteAdjustment,
              contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
              encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
            },
          });
        }

        // 4. Anchor Next NMA directly on the dashboard
        if (dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED && dto.nextNmaTitle) {
          await tx.action.updateMany({
            where: { goalId: dto.goalId, isNMA: true },
            data: { isNMA: false },
          });

          await tx.action.create({
            data: {
              userId,
              goalId: dto.goalId,
              title: dto.nextNmaTitle,
              description: `Anchored during Weekly Review (${weekEndingDate.toISOString().split('T')[0]})`,
              status: ActionStatus.PENDING,
              isNMA: true,
            },
          });
        }

        return review;
      });
    }

    const newRev = {
      id: reviewId,
      userId,
      goalId: dto.goalId,
      weekEndingDate,
      meaningfulProgress: dto.meaningfulProgress,
      actionsThatMattered: dto.actionsThatMattered,
      whatGotInTheWay: dto.whatGotInTheWay,
      interventionsThatHelped: dto.interventionsThatHelped,
      interventionsThatDidNotHelp: dto.interventionsThatDidNotHelp,
      nextNmaTitle: dto.nextNmaTitle,
      createdAt: new Date(),
    };
    this.memoryReviews.set(reviewId, newRev);

    await this.auditService.log({
      actorId: userId,
      action: 'WEEKLY_REVIEW_COMPLETED',
      targetId: reviewId,
      targetType: 'WEEKLY_REVIEW',
    });

    return newRev;
  }

  async getLessons(userId: string) {
    if (this.prisma.isConnected) {
      return await this.prisma.lesson.findMany({
        where: { userId },
        include: { goal: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return [
      {
        id: 'les-1',
        userId,
        lessonText: 'Direct phone outreach produces immediate customer clarity faster than designing forms.',
        adjustmentText: 'Block 45 minutes every Tuesday morning strictly for calls.',
        createdAt: new Date('2026-09-14'),
      },
    ];
  }

  async getAdjustments(userId: string) {
    if (!this.prisma.isConnected) return [];
    return this.prisma.adjustment.findMany({ where: { weeklyReview: { userId } }, include: { weeklyReview: { select: { id: true, goalId: true, weekEndingDate: true } } }, orderBy: { createdAt: 'desc' } });
  }
}
