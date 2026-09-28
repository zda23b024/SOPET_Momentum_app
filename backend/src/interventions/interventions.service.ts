import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ActionsService } from '../actions/actions.service';
import { ContentEncoding, Prisma } from '@prisma/client';
import { PRIVATE_FIELDS, validateEncryptedContent } from '../common/privacy/content-envelope';
import { ApplyInterventionDto } from './dto/interventions.dto';

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actionsService: ActionsService,
  ) {}

  async getInterventions() {
    if (this.prisma.isConnected) {
      return await this.prisma.intervention.findMany({
        where: { isPublished: true },
        include: { barrierDef: true },
        orderBy: { code: 'asc' },
      });
    }

    return [
      {
        code: 'INT_CLARIFY',
        name: 'Clarify Action Boundary',
        targetBarrierCode: 'UNCLEAR_NEXT_STEP',
        summary: 'Define physical boundary of the action.',
      },
      {
        code: 'INT_MMA_OVERWHELM',
        name: 'Minimum Meaningful Action (MMA)',
        targetBarrierCode: 'OVERWHELM',
        summary: 'Reduce action to a 10-15 minute micro-step.',
      },
      {
        code: 'INT_RESOURCE_ACQUIRE',
        name: 'Resource Acquisition Action',
        targetBarrierCode: 'RESOURCE_GAP',
        summary: 'Designate getting the tool/resource as its own action.',
      },
    ];
  }

  async linkInterventionToAction(
    userId: string,
    actionId: string,
    interventionCode: string,
    barrierId: string | undefined,
    dto: ApplyInterventionDto,
  ) {
    const action = await this.actionsService.getActionById(userId, actionId);
    if (action.goal?.privacyMode !== 'STANDARD_PRIVATE' && dto.contentEncoding !== ContentEncoding.CLIENT_ENCRYPTED) throw new ForbiddenException({ code: 'PRIVACY_MODE_MISMATCH' });
    validateEncryptedContent(dto as unknown as Record<string, unknown>, PRIVATE_FIELDS.intervention);

    if (this.prisma.isConnected) {
      const intv = await this.prisma.intervention.findUnique({
        where: { code: interventionCode },
      });
      if (!intv) throw new NotFoundException('Intervention not found');

      return await this.prisma.actionIntervention.create({
        data: {
          actionId,
          barrierId,
          interventionId: intv.id,
          outcomeNotes: dto.contentEncoding === ContentEncoding.CLIENT_ENCRYPTED ? null : dto.outcomeNotes,
          contentEncoding: dto.contentEncoding ?? ContentEncoding.PLAINTEXT,
          encryptedPayload: dto.encryptedPayload as Prisma.InputJsonValue,
        },
        include: { intervention: true },
      });
    }

    return {
      id: 'ai-' + Date.now(),
      actionId,
      interventionCode,
      outcomeNotes: dto.outcomeNotes,
      appliedAt: new Date(),
    };
  }
}
