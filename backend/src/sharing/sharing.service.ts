import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalAccessGrantStatus,
  GoalAccessPermission,
  GoalAccessRequestStatus,
  PrivacyMode,
  UserRoleType,
  ContentEncoding,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApproveGoalAccessRequestDto, CommitEncryptedRevocationDto, GrantGoalAccessDto, RegisterSharingKeyDto, RequestGoalAccessDto } from './dto/sharing.dto';
import { validateEncryptedContent } from '../common/privacy/content-envelope';

const STAFF_ROLES: UserRoleType[] = [UserRoleType.SUPPORT_ADMIN, UserRoleType.PRODUCT_ADMIN];
const STAFF_PERMISSIONS = ['goal.shared.request', 'goal.shared.view'];

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private requireDatabase() {
    if (!this.prisma.isConnected) throw new BadRequestException('DATABASE_UNAVAILABLE');
  }

  private isEligibleStaff(user: { userRoles?: Array<{ role: { name: UserRoleType; permissions?: Array<{ permission: { code: string } }> } }>; permissions?: string[] }) {
    const roles = user.userRoles?.map(item => item.role.name) ?? [];
    const permissions = user.permissions ?? user.userRoles?.flatMap(item => item.role.permissions?.map(value => value.permission.code) ?? []) ?? [];
    return roles.some(role => STAFF_ROLES.includes(role)) && STAFF_PERMISSIONS.every(permission => permissions.includes(permission));
  }

  private async getOwnedGoal(ownerUserId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== ownerUserId) throw new ForbiddenException('Only the Goal owner may manage sharing');
    return goal;
  }

  async listEligibleStaff() {
    this.requireDatabase();
    const staff = await this.prisma.user.findMany({
      where: { isActive: true, userRoles: { some: { role: { name: { in: STAFF_ROLES } } } } },
      select: {
        id: true,
        email: true,
        fullName: true,
        userRoles: { select: { role: { select: { name: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
      },
      orderBy: { fullName: 'asc' },
    });
    return staff.filter(user => this.isEligibleStaff(user));
  }

  async listGrants(ownerUserId: string, goalId: string) {
    this.requireDatabase();
    await this.getOwnedGoal(ownerUserId, goalId);
    return this.prisma.goalAccessGrant.findMany({
      where: { goalId, ownerUserId },
      select: {
        id: true,
        goalId: true,
        granteeUserId: true,
        granteeRoleSnapshot: true,
        permission: true,
        status: true,
        supportPurpose: true,
        createdAt: true,
        grantedAt: true,
        expiresAt: true,
        revokedAt: true,
        revocationRotationId: true,
        revocationStartedAt: true,
        revocationError: true,
        lastViewedAt: true,
        grantee: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async grant(ownerUserId: string, goalId: string, dto: GrantGoalAccessDto) {
    this.requireDatabase();
    const goal = await this.getOwnedGoal(ownerUserId, goalId);
    if (dto.permission !== GoalAccessPermission.VIEW) throw new BadRequestException('Only VIEW permission is currently supported');
    if (dto.granteeUserId === ownerUserId) throw new BadRequestException('A Goal cannot be shared with its owner');
    if (goal.privacyMode === PrivacyMode.HIGHLY_CONFIDENTIAL && !dto.highlyConfidentialConfirmation) {
      throw new BadRequestException('Highly Confidential sharing requires explicit confirmation');
    }
    if (goal.privacyMode !== PrivacyMode.STANDARD_PRIVATE && !dto.encryptedKeyEnvelope) {
      throw new BadRequestException('Encrypted Goals require a grantee-specific encrypted key envelope');
    }
    const grantee = await this.prisma.user.findUnique({
      where: { id: dto.granteeUserId },
      include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!grantee || !grantee.isActive || !this.isEligibleStaff(grantee)) {
      throw new ForbiddenException('Selected account is not authorized for Goal support access');
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException('Access expiry must be in the future');
    const grant = await this.prisma.goalAccessGrant.create({
      data: {
        goalId,
        ownerUserId,
        granteeUserId: grantee.id,
        granteeRoleSnapshot: grantee.userRoles.find(item => STAFF_ROLES.includes(item.role.name))!.role.name,
        permission: GoalAccessPermission.VIEW,
        status: GoalAccessGrantStatus.ACTIVE,
        grantedAt: new Date(),
        expiresAt,
        supportPurpose: dto.supportPurpose,
        encryptedKeyEnvelope: dto.encryptedKeyEnvelope,
        encryptionMetadata: dto.encryptionMetadata as any,
      },
      select: { id: true, goalId: true, granteeUserId: true, permission: true, status: true, grantedAt: true, expiresAt: true },
    });
    await this.auditService.log({ actorId: ownerUserId, action: 'GOAL_ACCESS_GRANTED', targetId: goalId, targetType: 'GOAL', details: { grantId: grant.id, granteeUserId: grantee.id, permission: grant.permission, expiresAt: grant.expiresAt } });
    return grant;
  }

  async revoke(ownerUserId: string, goalId: string, grantId: string) {
    this.requireDatabase();
    await this.getOwnedGoal(ownerUserId, goalId);
    const grant = await this.prisma.goalAccessGrant.findFirst({ where: { id: grantId, goalId, ownerUserId, status: GoalAccessGrantStatus.ACTIVE } });
    if (!grant) throw new NotFoundException('Goal access grant not found');
    const goal = await this.getOwnedGoal(ownerUserId, goalId);
    if (goal.privacyMode !== PrivacyMode.STANDARD_PRIVATE) throw new BadRequestException({ code: 'KEY_ROTATION_REQUIRED', message: 'Encrypted access must be revoked through key rotation.' });
    const revoked = await this.prisma.goalAccessGrant.update({ where: { id: grant.id }, data: { status: GoalAccessGrantStatus.REVOKED, revokedAt: new Date(), revokedBy: ownerUserId }, select: { id: true, status: true, revokedAt: true } });
    await this.auditService.log({ actorId: ownerUserId, action: 'GOAL_ACCESS_REVOKED', targetId: goalId, targetType: 'GOAL', details: { grantId } });
    return revoked;
  }

  private async encryptedGraph(client: any, goalId: string) {
    const [milestones, actions, nmaRecords, readinessAssessments, barriers, actionInterventions, mmas, interruptions, restarts, kpis, kpiValues, weeklyReviews, lessons, adjustments] = await Promise.all([
      client.milestone.findMany({ where: { goalId } }), client.action.findMany({ where: { goalId } }),
      client.nMARecord.findMany({ where: { action: { goalId } } }), client.readinessAssessment.findMany({ where: { action: { goalId } } }),
      client.barrier.findMany({ where: { action: { goalId } } }), client.actionIntervention.findMany({ where: { action: { goalId } } }),
      client.mMA.findMany({ where: { parentAction: { goalId } } }), client.interruption.findMany({ where: { goalId } }),
      client.restart.findMany({ where: { interruption: { goalId } } }), client.kPI.findMany({ where: { goalId } }),
      client.kPIValue.findMany({ where: { kpi: { goalId } } }), client.weeklyReview.findMany({ where: { goalId } }),
      client.lesson.findMany({ where: { goalId } }), client.adjustment.findMany({ where: { weeklyReview: { goalId } } }),
    ]);
    return { milestones, actions, nmaRecords, readinessAssessments, barriers, actionInterventions, mmas, interruptions, restarts, kpis, kpiValues, weeklyReviews, lessons, adjustments };
  }

  async beginEncryptedRevocation(ownerUserId: string, goalId: string, grantId: string) {
    this.requireDatabase();
    const goal = await this.getOwnedGoal(ownerUserId, goalId);
    if (goal.privacyMode === PrivacyMode.STANDARD_PRIVATE) throw new BadRequestException('STANDARD_PRIVATE revocation does not require key rotation');
    const grant = await this.prisma.goalAccessGrant.findFirst({ where: { id: grantId, goalId, ownerUserId, status: GoalAccessGrantStatus.ACTIVE } });
    if (!grant) throw new NotFoundException('Active Goal access grant not found');
    const rotationId = grant.revocationRotationId ?? randomUUID();
    if (!grant.revocationRotationId) await this.prisma.goalAccessGrant.update({ where: { id: grantId }, data: { revocationRotationId: rotationId, revocationStartedAt: new Date(), revocationError: null } });
    const remaining = await this.prisma.goalAccessGrant.findMany({ where: { goalId, status: GoalAccessGrantStatus.ACTIVE, id: { not: grantId }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, granteeUserId: true } });
    const remainingGrants = await Promise.all(remaining.map(async item => {
      const key = await this.prisma.adminSharingKey.findFirst({ where: { userId: item.granteeUserId, isActive: true }, orderBy: { keyVersion: 'desc' }, select: { publicKey: true, keyVersion: true } });
      if (!key) throw new ConflictException({ code: 'REMAINING_GRANTEE_KEY_MISSING', grantId: item.id });
      return { grantId: item.id, granteeUserId: item.granteeUserId, publicKey: key.publicKey, staffKeyVersion: key.keyVersion };
    }));
    return { rotationId, targetGrantId: grantId, previousGoalKeyVersion: goal.goalKeyVersion, goal, records: await this.encryptedGraph(this.prisma, goalId), remainingGrants };
  }

  private validateEnvelope(value: Record<string, unknown>) {
    validateEncryptedContent({ contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: value }, []);
    const allowed = new Set(['version', 'algorithm', 'keyVersion', 'iv', 'ciphertext', 'aadVersion', 'schemaVersion']);
    if (Object.keys(value).some(key => !allowed.has(key))) throw new BadRequestException({ code: 'ROTATION_PLAINTEXT_REJECTED' });
  }

  async commitEncryptedRevocation(ownerUserId: string, goalId: string, grantId: string, dto: CommitEncryptedRevocationDto) {
    this.requireDatabase();
    this.validateEnvelope(dto.goalEncryptedPayload); this.validateEnvelope(dto.ownerWrappedGoalKey);
    return this.prisma.$transaction(async tx => {
      const goal = await tx.goal.findFirst({ where: { id: goalId, userId: ownerUserId } });
      if (!goal) throw new ForbiddenException('Only the Goal owner may manage sharing');
      const target = await tx.goalAccessGrant.findFirst({ where: { id: grantId, goalId, ownerUserId, status: GoalAccessGrantStatus.ACTIVE, revocationRotationId: dto.rotationId } });
      if (!target) throw new ConflictException('Revocation rotation token is stale or inactive');
      if (dto.previousGoalKeyVersion !== goal.goalKeyVersion || dto.goalKeyVersion !== goal.goalKeyVersion + 1) throw new ConflictException({ code: 'GOAL_KEY_VERSION_CONFLICT' });
      const records = await this.encryptedGraph(tx, goalId);
      const collections = ['milestones','actions','nmaRecords','readinessAssessments','barriers','actionInterventions','mmas','interruptions','restarts','kpis','kpiValues','weeklyReviews','lessons','adjustments'] as const;
      for (const name of collections) {
        const expected = records[name].map((item: any) => item.id).sort(); const supplied = dto[name]; const actual = supplied.map(item => item.id).sort();
        if (new Set(actual).size !== actual.length || expected.length !== actual.length || expected.some((id: string, i: number) => id !== actual[i])) throw new BadRequestException({ code: 'INCOMPLETE_ROTATION_GRAPH', collection: name });
        supplied.forEach(item => this.validateEnvelope(item.encryptedPayload));
      }
      const remaining = await tx.goalAccessGrant.findMany({ where: { goalId, status: GoalAccessGrantStatus.ACTIVE, id: { not: grantId }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, granteeUserId: true } });
      const expectedGrants = remaining.map(item => `${item.id}:${item.granteeUserId}`).sort();
      const suppliedGrants = dto.remainingGrantEnvelopes.map(item => `${item.grantId}:${item.granteeUserId}`).sort();
      if (new Set(suppliedGrants).size !== suppliedGrants.length || expectedGrants.length !== suppliedGrants.length || expectedGrants.some((value, i) => value !== suppliedGrants[i]) || dto.remainingGrantEnvelopes.some(item => item.granteeUserId === target.granteeUserId)) throw new BadRequestException({ code: 'INVALID_REMAINING_GRANT_ENVELOPES' });
      const encrypted = (item: any) => ({ contentEncoding: ContentEncoding.CLIENT_ENCRYPTED, encryptedPayload: item.encryptedPayload as Prisma.InputJsonValue, plaintextContent: Prisma.DbNull });
      await Promise.all([
        ...dto.milestones.map(item => tx.milestone.update({ where: { id: item.id }, data: { ...encrypted(item), title: null, description: null } })), ...dto.actions.map(item => tx.action.update({ where: { id: item.id }, data: { ...encrypted(item), title: null, description: null } })),
        ...dto.nmaRecords.map(item => tx.nMARecord.update({ where: { id: item.id }, data: { ...encrypted(item), rationale: null } })), ...dto.readinessAssessments.map(item => tx.readinessAssessment.update({ where: { id: item.id }, data: { ...encrypted(item), notes: null } })),
        ...dto.barriers.map(item => tx.barrier.update({ where: { id: item.id }, data: { ...encrypted(item), userExplanation: null } })), ...dto.actionInterventions.map(item => tx.actionIntervention.update({ where: { id: item.id }, data: { ...encrypted(item), outcomeNotes: null } })),
        ...dto.mmas.map(item => tx.mMA.update({ where: { id: item.id }, data: { ...encrypted(item), title: null } })), ...dto.interruptions.map(item => tx.interruption.update({ where: { id: item.id }, data: { ...encrypted(item), causeDescription: null } })),
        ...dto.restarts.map(item => tx.restart.update({ where: { id: item.id }, data: { ...encrypted(item), whatChanged: null, rootCause: null, restartActionTitle: null } })), ...dto.kpis.map(item => tx.kPI.update({ where: { id: item.id }, data: { ...encrypted(item), name: null, unit: null } })),
        ...dto.kpiValues.map(item => tx.kPIValue.update({ where: { id: item.id }, data: { ...encrypted(item), notes: null } })), ...dto.weeklyReviews.map(item => tx.weeklyReview.update({ where: { id: item.id }, data: { ...encrypted(item), meaningfulProgress: null, actionsThatMattered: null, whatGotInTheWay: null, interventionsThatHelped: null, interventionsThatDidNotHelp: null, restartDetails: null, nextNmaTitle: null, aiSummaryDraft: null } })),
        ...dto.lessons.map(item => tx.lesson.update({ where: { id: item.id }, data: { ...encrypted(item), lessonText: null, adjustmentText: null } })), ...dto.adjustments.map(item => tx.adjustment.update({ where: { id: item.id }, data: { ...encrypted(item), description: null } })),
        ...dto.remainingGrantEnvelopes.map(item => tx.goalAccessGrant.update({ where: { id: item.grantId }, data: { encryptedKeyEnvelope: item.encryptedKeyEnvelope, encryptionMetadata: item.encryptionMetadata as Prisma.InputJsonValue } })),
      ]);
      await tx.goal.update({ where: { id: goalId }, data: { encryptedPayload: dto.goalEncryptedPayload as Prisma.InputJsonValue, ownerWrappedGoalKey: dto.ownerWrappedGoalKey as Prisma.InputJsonValue, goalKeyVersion: dto.goalKeyVersion } });
      await tx.goalAccessGrant.update({ where: { id: grantId }, data: { status: GoalAccessGrantStatus.REVOKED, revokedAt: new Date(), revokedBy: ownerUserId, encryptedKeyEnvelope: null, encryptionMetadata: Prisma.DbNull, revocationError: null } });
      return { status: GoalAccessGrantStatus.REVOKED, goalKeyVersion: dto.goalKeyVersion };
    }).then(async result => { await this.auditService.log({ actorId: ownerUserId, action: 'GOAL_ACCESS_CRYPTOGRAPHICALLY_REVOKED', targetId: goalId, targetType: 'GOAL', details: { grantId, goalKeyVersion: result.goalKeyVersion } }); return result; });
  }

  async failEncryptedRevocation(ownerUserId: string, goalId: string, grantId: string, rotationId: string, errorCode: string) {
    await this.getOwnedGoal(ownerUserId, goalId);
    const result = await this.prisma.goalAccessGrant.updateMany({ where: { id: grantId, goalId, ownerUserId, status: GoalAccessGrantStatus.ACTIVE, revocationRotationId: rotationId }, data: { revocationError: errorCode.slice(0, 100) } });
    if (!result.count) throw new ConflictException('Revocation rotation is no longer active');
    return { status: 'ROTATION_FAILED', resumable: true };
  }

  async requestAccess(user: AuthenticatedUser, goalId: string, dto: RequestGoalAccessDto) {
    this.requireDatabase();
    if (!user.permissions.includes('goal.shared.request') || !user.roles.some(role => STAFF_ROLES.includes(role as UserRoleType))) throw new ForbiddenException('Goal access requests are restricted to authorized support staff');
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId }, select: { id: true, userId: true } });
    if (!goal) throw new NotFoundException('Goal not found');
    const request = await this.prisma.goalAccessRequest.create({ data: { goalId, ownerUserId: goal.userId, requesterId: user.id, reason: dto.reason } });
    await this.auditService.log({ actorId: user.id, action: 'GOAL_ACCESS_REQUESTED', targetId: goalId, targetType: 'GOAL', details: { requestId: request.id, ownerUserId: goal.userId } });
    return request;
  }

  async approveRequest(ownerUserId: string, goalId: string, requestId: string, dto: ApproveGoalAccessRequestDto) {
    this.requireDatabase();
    const goal = await this.getOwnedGoal(ownerUserId, goalId);
    if (goal.privacyMode === PrivacyMode.HIGHLY_CONFIDENTIAL && !dto.highlyConfidentialConfirmation) throw new BadRequestException('Highly Confidential sharing requires explicit confirmation');
    if (goal.privacyMode !== PrivacyMode.STANDARD_PRIVATE && !dto.encryptedKeyEnvelope) throw new BadRequestException('Encrypted Goals require a grantee-specific encrypted key envelope');
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException('Access expiry must be in the future');

    const result = await this.prisma.$transaction(async tx => {
      const request = await tx.goalAccessRequest.findFirst({ where: { id: requestId, goalId, ownerUserId, status: GoalAccessRequestStatus.PENDING }, include: { requester: { include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } });
      if (!request) throw new NotFoundException('Pending Goal access request not found');
      if (!request.requester.isActive || !this.isEligibleStaff(request.requester)) throw new ForbiddenException('Requester is no longer eligible for Goal support access');
      const duplicate = await tx.goalAccessGrant.findFirst({ where: { goalId, granteeUserId: request.requesterId, status: GoalAccessGrantStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (duplicate) throw new BadRequestException('An active grant already exists for this staff member');
      const role = request.requester.userRoles.find(item => STAFF_ROLES.includes(item.role.name))!.role.name;
      const grant = await tx.goalAccessGrant.create({ data: { goalId, ownerUserId, granteeUserId: request.requesterId, granteeRoleSnapshot: role, permission: GoalAccessPermission.VIEW, status: GoalAccessGrantStatus.ACTIVE, grantedAt: new Date(), expiresAt, supportPurpose: request.reason, encryptedKeyEnvelope: dto.encryptedKeyEnvelope, encryptionMetadata: dto.encryptionMetadata as any } });
      await tx.goalAccessRequest.update({ where: { id: request.id }, data: { status: GoalAccessRequestStatus.APPROVED, resolvedAt: new Date() } });
      return { requestId: request.id, requesterId: request.requesterId, grant };
    });
    await this.auditService.log({ actorId: ownerUserId, action: 'GOAL_ACCESS_GRANTED', targetId: goalId, targetType: 'GOAL', details: { requestId: result.requestId, grantId: result.grant.id, granteeUserId: result.requesterId, permission: GoalAccessPermission.VIEW } });
    return result.grant;
  }

  async denyRequest(ownerUserId: string, goalId: string, requestId: string) {
    this.requireDatabase();
    await this.getOwnedGoal(ownerUserId, goalId);
    const request = await this.prisma.goalAccessRequest.findFirst({ where: { id: requestId, goalId, ownerUserId, status: GoalAccessRequestStatus.PENDING } });
    if (!request) throw new NotFoundException('Pending Goal access request not found');
    const updated = await this.prisma.goalAccessRequest.update({ where: { id: request.id }, data: { status: GoalAccessRequestStatus.DENIED, resolvedAt: new Date() } });
    await this.auditService.log({ actorId: ownerUserId, action: 'GOAL_ACCESS_REQUEST_DENIED', targetId: goalId, targetType: 'GOAL', details: { requestId, requesterId: request.requesterId } });
    return updated;
  }

  async listSharedWithMe(user: AuthenticatedUser) {
    this.requireDatabase();
    if (!user.permissions.includes('goal.shared.view') || !user.roles.some(role => STAFF_ROLES.includes(role as UserRoleType))) throw new ForbiddenException('Shared Goal access is not authorized for this account');
    await this.expireGrants(user.id);
    return this.prisma.goalAccessGrant.findMany({
      where: { granteeUserId: user.id, permission: GoalAccessPermission.VIEW, status: GoalAccessGrantStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, goalId: true, ownerUserId: true, permission: true, grantedAt: true, expiresAt: true, lastViewedAt: true, goal: { select: { id: true, privacyMode: true, status: true, targetDate: true } } },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async getSharedGoal(user: AuthenticatedUser, goalId: string) {
    this.requireDatabase();
    if (!user.permissions.includes('goal.shared.view') || !user.roles.some(role => STAFF_ROLES.includes(role as UserRoleType))) throw new ForbiddenException('Shared Goal access is not authorized for this account');
    await this.expireGrants(user.id);
    const grant = await this.prisma.goalAccessGrant.findFirst({ where: { goalId, granteeUserId: user.id, permission: GoalAccessPermission.VIEW, status: GoalAccessGrantStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!grant) throw new ForbiddenException('No active authorization exists for this Goal');
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId }, include: { milestones: true, actions: true } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.prisma.goalAccessGrant.update({ where: { id: grant.id }, data: { lastViewedAt: new Date() } });
    await this.auditService.log({ actorId: user.id, action: 'GOAL_ACCESS_VIEWED', targetId: goalId, targetType: 'GOAL', details: { grantId: grant.id, ownerUserId: grant.ownerUserId } });
    if (goal.privacyMode !== PrivacyMode.STANDARD_PRIVATE) return { grant: { id: grant.id, ownerUserId: grant.ownerUserId, granteeUserId: grant.granteeUserId, permission: grant.permission, encryptedKeyEnvelope: grant.encryptedKeyEnvelope, encryptionMetadata: grant.encryptionMetadata }, goal: { id: goal.id, privacyMode: goal.privacyMode, contentEncoding: goal.contentEncoding, encryptedPayload: goal.encryptedPayload, milestones: goal.milestones.map(item => ({ id: item.id, encryptedPayload: item.encryptedPayload, contentEncoding: item.contentEncoding })), actions: goal.actions.map(item => ({ id: item.id, encryptedPayload: item.encryptedPayload, contentEncoding: item.contentEncoding })) } };
    return { grant: { id: grant.id, permission: grant.permission }, goal };
  }

  async registerSharingKey(user: AuthenticatedUser, dto: RegisterSharingKeyDto) {
    this.requireDatabase();
    if (!user.roles.some(role => STAFF_ROLES.includes(role as UserRoleType)) || !user.permissions.includes('goal.shared.view')) throw new ForbiddenException('Sharing keys are restricted to authorized support staff');
    const latest = await this.prisma.adminSharingKey.findFirst({ where: { userId: user.id }, orderBy: { keyVersion: 'desc' } });
    if (latest) await this.prisma.adminSharingKey.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, rotatedAt: new Date() } });
    const key = await this.prisma.adminSharingKey.create({ data: { userId: user.id, algorithm: dto.algorithm, publicKey: dto.publicKey, wrappedPrivateKey: dto.wrappedPrivateKey as any, privateKeyMetadata: dto.privateKeyMetadata as any, keyVersion: (latest?.keyVersion ?? 0) + 1 } });
    await this.auditService.log({ actorId: user.id, action: 'GOAL_SHARE_KEY_CREATED', targetId: key.id, targetType: 'ADMIN_SHARING_KEY', details: { algorithm: key.algorithm, keyVersion: key.keyVersion } });
    return { id: key.id, algorithm: key.algorithm, publicKey: key.publicKey, keyVersion: key.keyVersion };
  }

  async getOwnSharingKey(user: AuthenticatedUser) {
    this.requireDatabase();
    if (!user.roles.some(role => STAFF_ROLES.includes(role as UserRoleType)) || !user.permissions.includes('goal.shared.view')) throw new ForbiddenException('Sharing keys are restricted to authorized support staff');
    return this.prisma.adminSharingKey.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { keyVersion: 'desc' }, select: { algorithm: true, publicKey: true, wrappedPrivateKey: true, privateKeyMetadata: true, keyVersion: true } });
  }

  async getActiveSharingKey(userId: string) {
    this.requireDatabase();
    const key = await this.prisma.adminSharingKey.findFirst({ where: { userId, isActive: true }, orderBy: { keyVersion: 'desc' }, select: { userId: true, algorithm: true, publicKey: true, keyVersion: true } });
    if (!key) throw new NotFoundException('Authorized staff sharing key not found');
    return key;
  }

  private async expireGrants(granteeUserId?: string) {
    await this.prisma.goalAccessGrant.updateMany({ where: { status: GoalAccessGrantStatus.ACTIVE, ...(granteeUserId ? { granteeUserId } : {}), expiresAt: { lte: new Date() } }, data: { status: GoalAccessGrantStatus.EXPIRED } });
  }
}
