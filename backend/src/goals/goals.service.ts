import { BadRequestException, ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGoalDto, UpdateGoalStatusDto, UpgradeGoalPrivacyDto } from './dto/goals.dto';
import { ContentEncoding, GoalStatus, PrivacyMigrationStatus, PrivacyMode, Prisma } from '@prisma/client';
import { assertNoPrivacyDowngrade, PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';
import { CommitGoalKeyMigrationDto, MigratedRecordDto } from './dto/goal-key-migration.dto';

@Injectable()
export class GoalsService {
  private memoryGoals = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.initDemoGoals();
  }

  private initDemoGoals() {
    this.memoryGoals.set('goal-amina-primary', {
      id: 'goal-amina-primary',
      userId: 'usr-amina-demo',
      title: 'Start a catering business',
      description: 'Launch an artisan lunch catering service for local offices within 6 months.',
      whyItMatters: 'Achieve financial independence and express culinary passion.',
      status: 'ACTIVE',
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getGoals(userId: string) {
    if (this.prisma.isConnected) {
      return await this.prisma.goal.findMany({
        where: { userId },
        include: {
          milestones: { orderBy: { orderIndex: 'asc' } },
          actions: { include: { mmaChildActions: true, barriers: true } },
          kpis: { include: { values: { orderBy: { recordedAt: 'desc' }, take: 10 } } },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      });
    }

    return Array.from(this.memoryGoals.values()).filter((g) => g.userId === userId);
  }

  async getGoalById(userId: string, goalId: string) {
    let goal: any;
    if (this.prisma.isConnected) {
      goal = await this.prisma.goal.findUnique({
        where: { id: goalId },
        include: {
          milestones: { orderBy: { orderIndex: 'asc' } },
          actions: { include: { mmaChildActions: true, barriers: true } },
          kpis: { include: { values: { orderBy: { recordedAt: 'desc' } } } },
          statusHistory: { orderBy: { changedAt: 'desc' } },
        },
      });
    } else {
      goal = this.memoryGoals.get(goalId);
    }

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    // Strict ownership verification: Prevent IDOR / BOLA!
    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied: You do not own this goal');
    }

    return goal;
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.goal);
    const goalId = dto.id || crypto.randomUUID();

    if (this.prisma.isConnected) {
      // If setting this goal as primary, demote other goals
      if (dto.isPrimary) {
        await this.prisma.goal.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await this.prisma.goal.create({
        data: {
          id: goalId,
          userId,
          title: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.title,
          description: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.description,
          whyItMatters: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.whyItMatters,
          isPrimary: dto.isPrimary ?? false,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
          isClientEncrypted: dto.isClientEncrypted ?? false,
          ciphertextPayload: dto.ciphertextPayload,
          encryptionMetadata: dto.encryptionMetadata,
          privacyMode: dto.privacyMode ?? PrivacyMode.STANDARD_PRIVATE,
          contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
          plaintextContent: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? undefined : dto.plaintextContent as Prisma.InputJsonValue,
          encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
          ownerWrappedGoalKey: dto.ownerWrappedGoalKey as Prisma.InputJsonValue,
          goalKeyVersion: dto.ownerWrappedGoalKey ? 1 : undefined,
          privacyMigrationStatus: dto.ownerWrappedGoalKey ? PrivacyMigrationStatus.COMPLETED : PrivacyMigrationStatus.NOT_STARTED,
          privacyMigrationCompletedAt: dto.ownerWrappedGoalKey ? new Date() : undefined,
          statusHistory: {
            create: {
              oldStatus: GoalStatus.NOT_STARTED,
              newStatus: GoalStatus.ACTIVE,
              reason: 'Initial goal creation',
            },
          },
        },
      });

      await this.auditService.log({
        actorId: userId,
        action: 'GOAL_CREATED',
        targetId: goalId,
        targetType: 'GOAL',
        details: { isPrimary: dto.isPrimary },
      });

      return created;
    }

    const newGoal = {
      id: goalId,
      userId,
      title: dto.title,
      description: dto.description,
      whyItMatters: dto.whyItMatters,
      status: 'ACTIVE',
      isPrimary: dto.isPrimary ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memoryGoals.set(goalId, newGoal);
    return newGoal;
  }

  async upgradePrivacy(userId: string, goalId: string, dto: UpgradeGoalPrivacyDto) {
    const goal = await this.getGoalById(userId, goalId);
    assertNoPrivacyDowngrade(goal.privacyMode, dto.privacyMode);
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.goal);
    if (!this.prisma.isConnected) throw new Error('DATABASE_UNAVAILABLE');
    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        privacyMode: dto.privacyMode,
        contentEncoding: ContentEncoding.CLIENT_ENCRYPTED,
        encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
        ownerWrappedGoalKey: dto.ownerWrappedGoalKey as Prisma.InputJsonValue,
        goalKeyVersion: 1,
        privacyMigrationStatus: PrivacyMigrationStatus.COMPLETED,
        privacyMigrationCompletedAt: new Date(),
        plaintextContent: null,
        title: null,
        description: null,
        whyItMatters: null,
        isClientEncrypted: true,
        ciphertextPayload: null,
        encryptionMetadata: null,
      },
    });
    await this.auditService.log({ actorId: userId, action: 'GOAL_ENCRYPTION_MIGRATION_COMPLETED', targetId: goalId, targetType: 'GOAL', details: { privacyMode: dto.privacyMode, version: 1 } });
    return updated;
  }

  async updateGoalStatus(userId: string, goalId: string, dto: UpdateGoalStatusDto) {
    const goal = await this.getGoalById(userId, goalId);

    if (this.prisma.isConnected) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.goalStatusHistory.create({
          data: {
            goalId,
            oldStatus: goal.status,
            newStatus: dto.status,
            reason: dto.reason,
          },
        });

        return await tx.goal.update({
          where: { id: goalId },
          data: { status: dto.status },
        });
      });

      await this.auditService.log({
        actorId: userId,
        action: 'GOAL_STATUS_UPDATED',
        targetId: goalId,
        targetType: 'GOAL',
        details: { oldStatus: goal.status, newStatus: dto.status },
      });

      return updated;
    }

    goal.status = dto.status;
    this.memoryGoals.set(goalId, goal);
    return goal;
  }

  async listLegacyKeyMigrations(userId: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    return this.prisma.goal.findMany({
      where: { userId, privacyMode: { in: [PrivacyMode.ENCRYPTED_PRIVATE, PrivacyMode.HIGHLY_CONFIDENTIAL] } },
      select: { id: true, privacyMode: true, ownerWrappedGoalKey: true, goalKeyVersion: true, privacyMigrationStatus: true, privacyMigrationStartedAt: true, privacyMigrationCompletedAt: true, privacyMigrationError: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async beginGoalKeyMigration(userId: string, goalId: string) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    const goal = await this.getGoalById(userId, goalId);
    if (goal.privacyMode === PrivacyMode.STANDARD_PRIVATE) throw new BadRequestException('STANDARD_PRIVATE Goals do not require key migration');
    if (goal.ownerWrappedGoalKey && goal.goalKeyVersion > 0) {
      if (goal.privacyMigrationStatus !== PrivacyMigrationStatus.COMPLETED) await this.prisma.goal.update({ where: { id: goalId }, data: { privacyMigrationStatus: PrivacyMigrationStatus.COMPLETED, privacyMigrationCompletedAt: new Date(), privacyMigrationError: null } });
      return { skipped: true, reason: 'ALREADY_MIGRATED' };
    }
    const migrationId = goal.privacyMigrationStatus === PrivacyMigrationStatus.IN_PROGRESS && goal.privacyMigrationId ? goal.privacyMigrationId : crypto.randomUUID();
    await this.prisma.goal.update({ where: { id: goalId }, data: { privacyMigrationStatus: PrivacyMigrationStatus.IN_PROGRESS, privacyMigrationId: migrationId, privacyMigrationStartedAt: goal.privacyMigrationStartedAt ?? new Date(), privacyMigrationError: null } });
    const [milestones, actions, nmaRecords, readinessAssessments, barriers, actionInterventions, mmas, interruptions, restarts, kpis, kpiValues, weeklyReviews, lessons, adjustments] = await Promise.all([
      this.prisma.milestone.findMany({ where: { goalId } }),
      this.prisma.action.findMany({ where: { goalId } }),
      this.prisma.nMARecord.findMany({ where: { action: { goalId } } }),
      this.prisma.readinessAssessment.findMany({ where: { action: { goalId } } }),
      this.prisma.barrier.findMany({ where: { action: { goalId } } }),
      this.prisma.actionIntervention.findMany({ where: { action: { goalId } } }),
      this.prisma.mMA.findMany({ where: { parentAction: { goalId } } }),
      this.prisma.interruption.findMany({ where: { goalId } }),
      this.prisma.restart.findMany({ where: { interruption: { goalId } } }),
      this.prisma.kPI.findMany({ where: { goalId } }),
      this.prisma.kPIValue.findMany({ where: { kpi: { goalId } } }),
      this.prisma.weeklyReview.findMany({ where: { goalId } }),
      this.prisma.lesson.findMany({ where: { goalId } }),
      this.prisma.adjustment.findMany({ where: { weeklyReview: { goalId } } }),
    ]);
    return { skipped: false, migrationId, goal, records: { milestones, actions, nmaRecords, readinessAssessments, barriers, actionInterventions, mmas, interruptions, restarts, kpis, kpiValues, weeklyReviews, lessons, adjustments } };
  }

  async failGoalKeyMigration(userId: string, goalId: string, migrationId: string, errorCode: string) {
    await this.getGoalById(userId, goalId);
    const result = await this.prisma.goal.updateMany({ where: { id: goalId, privacyMigrationId: migrationId, OR: [{ ownerWrappedGoalKey: { equals: Prisma.DbNull } }, { goalKeyVersion: { lte: 0 } }] }, data: { privacyMigrationStatus: PrivacyMigrationStatus.FAILED, privacyMigrationError: errorCode.slice(0, 100) } });
    if (!result.count) throw new ConflictException('Migration is no longer active');
    return { status: PrivacyMigrationStatus.FAILED };
  }

  private validateMigrationEnvelope(payload: Record<string, unknown>) {
    validateEncryptedContent({ contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: payload }, []);
    const allowed = new Set(['version', 'algorithm', 'keyVersion', 'iv', 'ciphertext', 'aadVersion', 'schemaVersion']);
    const unexpected = Object.keys(payload).filter(key => !allowed.has(key));
    if (unexpected.length) throw new BadRequestException({ code: 'MIGRATION_PLAINTEXT_REJECTED', unexpected });
  }

  private assertCompleteSet(name: string, existing: Array<{ id: string }>, supplied: MigratedRecordDto[]) {
    const expected = existing.map(item => item.id).sort();
    const actual = supplied.map(item => item.id).sort();
    if (new Set(actual).size !== actual.length || expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) throw new BadRequestException({ code: 'INCOMPLETE_MIGRATION_GRAPH', collection: name });
    supplied.forEach(item => this.validateMigrationEnvelope(item.encryptedPayload));
  }

  async commitGoalKeyMigration(userId: string, goalId: string, dto: CommitGoalKeyMigrationDto) {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
    if (dto.goalKeyVersion < 1) throw new BadRequestException('Goal key version must be positive');
    this.validateMigrationEnvelope(dto.goalEncryptedPayload);
    this.validateMigrationEnvelope(dto.ownerWrappedGoalKey);
    return this.prisma.$transaction(async tx => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });
      if (!goal) throw new NotFoundException('Goal not found');
      if (goal.privacyMode === PrivacyMode.STANDARD_PRIVATE) throw new BadRequestException('STANDARD_PRIVATE Goals cannot be migrated');
      if (goal.ownerWrappedGoalKey && goal.goalKeyVersion > 0 && goal.privacyMigrationStatus === PrivacyMigrationStatus.COMPLETED) return { skipped: true, status: PrivacyMigrationStatus.COMPLETED };
      if (goal.privacyMigrationStatus !== PrivacyMigrationStatus.IN_PROGRESS || goal.privacyMigrationId !== dto.migrationId) throw new ConflictException('Migration token is stale or inactive');
      const existing = {
        milestones: await tx.milestone.findMany({ where: { goalId }, select: { id: true } }), actions: await tx.action.findMany({ where: { goalId }, select: { id: true } }),
        nmaRecords: await tx.nMARecord.findMany({ where: { action: { goalId } }, select: { id: true } }), readinessAssessments: await tx.readinessAssessment.findMany({ where: { action: { goalId } }, select: { id: true } }),
        barriers: await tx.barrier.findMany({ where: { action: { goalId } }, select: { id: true } }), actionInterventions: await tx.actionIntervention.findMany({ where: { action: { goalId } }, select: { id: true } }),
        mmas: await tx.mMA.findMany({ where: { parentAction: { goalId } }, select: { id: true } }), interruptions: await tx.interruption.findMany({ where: { goalId }, select: { id: true } }),
        restarts: await tx.restart.findMany({ where: { interruption: { goalId } }, select: { id: true } }), kpis: await tx.kPI.findMany({ where: { goalId }, select: { id: true } }),
        kpiValues: await tx.kPIValue.findMany({ where: { kpi: { goalId } }, select: { id: true } }), weeklyReviews: await tx.weeklyReview.findMany({ where: { goalId }, select: { id: true } }),
        lessons: await tx.lesson.findMany({ where: { goalId }, select: { id: true } }), adjustments: await tx.adjustment.findMany({ where: { weeklyReview: { goalId } }, select: { id: true } }),
      };
      (Object.keys(existing) as Array<keyof typeof existing>).forEach(name => this.assertCompleteSet(name, existing[name], dto[name]));
      const encrypted = (item: MigratedRecordDto) => ({ contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: item.encryptedPayload as Prisma.InputJsonValue, plaintextContent: Prisma.DbNull });
      await Promise.all([
        ...dto.milestones.map(item => tx.milestone.update({ where: { id: item.id }, data: { ...encrypted(item), title: null, description: null } })),
        ...dto.actions.map(item => tx.action.update({ where: { id: item.id }, data: { ...encrypted(item), title: null, description: null, isClientEncrypted: true, ciphertextPayload: null, encryptionMetadata: null } })),
        ...dto.nmaRecords.map(item => tx.nMARecord.update({ where: { id: item.id }, data: { ...encrypted(item), rationale: null } })),
        ...dto.readinessAssessments.map(item => tx.readinessAssessment.update({ where: { id: item.id }, data: { ...encrypted(item), notes: null } })),
        ...dto.barriers.map(item => tx.barrier.update({ where: { id: item.id }, data: { ...encrypted(item), userExplanation: null, isClientEncrypted: true, ciphertextExplanation: null, encryptionMetadata: null } })),
        ...dto.actionInterventions.map(item => tx.actionIntervention.update({ where: { id: item.id }, data: { ...encrypted(item), outcomeNotes: null } })),
        ...dto.mmas.map(item => tx.mMA.update({ where: { id: item.id }, data: { ...encrypted(item), title: null } })),
        ...dto.interruptions.map(item => tx.interruption.update({ where: { id: item.id }, data: { ...encrypted(item), causeDescription: null } })),
        ...dto.restarts.map(item => tx.restart.update({ where: { id: item.id }, data: { ...encrypted(item), whatChanged: null, rootCause: null, restartActionTitle: null } })),
        ...dto.kpis.map(item => tx.kPI.update({ where: { id: item.id }, data: { ...encrypted(item), name: null, unit: null } })),
        ...dto.kpiValues.map(item => tx.kPIValue.update({ where: { id: item.id }, data: { ...encrypted(item), notes: null } })),
        ...dto.weeklyReviews.map(item => tx.weeklyReview.update({ where: { id: item.id }, data: { ...encrypted(item), meaningfulProgress: null, actionsThatMattered: null, whatGotInTheWay: null, interventionsThatHelped: null, interventionsThatDidNotHelp: null, restartDetails: null, nextNmaTitle: null, aiSummaryDraft: null, isClientEncrypted: true, ciphertextPayload: null, encryptionMetadata: null } })),
        ...dto.lessons.map(item => tx.lesson.update({ where: { id: item.id }, data: { ...encrypted(item), lessonText: null, adjustmentText: null } })),
        ...dto.adjustments.map(item => tx.adjustment.update({ where: { id: item.id }, data: { ...encrypted(item), description: null } })),
      ]);
      await tx.goal.update({ where: { id: goalId }, data: { contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: dto.goalEncryptedPayload as Prisma.InputJsonValue, ownerWrappedGoalKey: dto.ownerWrappedGoalKey as Prisma.InputJsonValue, goalKeyVersion: dto.goalKeyVersion, title: null, description: null, whyItMatters: null, plaintextContent: Prisma.DbNull, isClientEncrypted: true, ciphertextPayload: null, encryptionMetadata: null, privacyMigrationStatus: PrivacyMigrationStatus.COMPLETED, privacyMigrationCompletedAt: new Date(), privacyMigrationError: null } });
      return { skipped: false, status: PrivacyMigrationStatus.COMPLETED, goalId, goalKeyVersion: dto.goalKeyVersion };
    });
  }
}
