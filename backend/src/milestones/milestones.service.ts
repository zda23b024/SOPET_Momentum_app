import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentEncoding, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestones.dto';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireDatabase() {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
  }

  private async ownedGoal(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId }, select: { id: true, userId: true, privacyMode: true } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== userId) throw new ForbiddenException('Goal does not belong to user');
    return goal;
  }

  async list(userId: string, goalId?: string) {
    this.requireDatabase();
    return this.prisma.milestone.findMany({ where: { goal: { userId }, goalId: goalId || undefined }, orderBy: [{ goalId: 'asc' }, { orderIndex: 'asc' }] });
  }

  async create(userId: string, dto: CreateMilestoneDto) {
    this.requireDatabase();
    const goal = await this.ownedGoal(userId, dto.goalId);
    if (goal.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.milestone);
    return this.prisma.milestone.create({ data: { goalId: dto.goalId, title: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.title, description: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.description, targetDate: dto.targetDate ? new Date(dto.targetDate) : null, orderIndex: dto.orderIndex ?? 0, contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT, encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue } });
  }

  async update(userId: string, milestoneId: string, dto: UpdateMilestoneDto) {
    this.requireDatabase();
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId }, include: { goal: { select: { userId: true, privacyMode: true } } } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.goal.userId !== userId) throw new ForbiddenException('Milestone does not belong to user');
    if (milestone.goal.privacyMode !== 'STANDARD_PRIVATE' && (dto.title !== undefined || dto.description !== undefined)) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    if (dto.contentEncoding) validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.milestone);
    return this.prisma.milestone.update({ where: { id: milestoneId }, data: { isCompleted: dto.isCompleted, completedAt: dto.isCompleted === true ? new Date() : dto.isCompleted === false ? null : undefined, title: dto.title, description: dto.description, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined, contentEncoding: dto.contentEncoding, encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue } });
  }

  async remove(userId: string, milestoneId: string) {
    this.requireDatabase();
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId }, include: { goal: { select: { userId: true } } } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.goal.userId !== userId) throw new ForbiddenException('Milestone does not belong to user');
    return this.prisma.milestone.delete({ where: { id: milestoneId } });
  }
}
