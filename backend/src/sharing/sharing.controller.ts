import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApproveGoalAccessRequestDto, CommitEncryptedRevocationDto, FailEncryptedRevocationDto, GrantGoalAccessDto, RegisterSharingKeyDto, RequestGoalAccessDto } from './dto/sharing.dto';
import { SharingService } from './sharing.service';

@ApiTags('Goal Sharing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('sharing/staff')
  listEligibleStaff() {
    return this.sharingService.listEligibleStaff();
  }

  @Get('goals/:goalId/access-grants')
  listGrants(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string) {
    return this.sharingService.listGrants(user.id, goalId);
  }

  @Post('goals/:goalId/access-grants')
  grant(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Body() dto: GrantGoalAccessDto) {
    return this.sharingService.grant(user.id, goalId, dto);
  }

  @Delete('goals/:goalId/access-grants/:grantId')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('grantId') grantId: string) {
    return this.sharingService.revoke(user.id, goalId, grantId);
  }

  @Post('goals/:goalId/access-requests')
  requestAccess(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Body() dto: RequestGoalAccessDto) {
    return this.sharingService.requestAccess(user, goalId, dto);
  }

  @Post('goals/:goalId/access-requests/:requestId/approve')
  approveRequest(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('requestId') requestId: string, @Body() dto: ApproveGoalAccessRequestDto) {
    return this.sharingService.approveRequest(user.id, goalId, requestId, dto);
  }

  @Post('goals/:goalId/access-requests/:requestId/deny')
  denyRequest(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('requestId') requestId: string) {
    return this.sharingService.denyRequest(user.id, goalId, requestId);
  }

  @Get('admin/shared-goals')
  sharedWithMe(@CurrentUser() user: AuthenticatedUser) {
    return this.sharingService.listSharedWithMe(user);
  }

  @Get('admin/shared-goals/:goalId')
  openSharedGoal(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string) {
    return this.sharingService.getSharedGoal(user, goalId);
  }

  @Post('admin/sharing-key')
  registerSharingKey(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterSharingKeyDto) {
    return this.sharingService.registerSharingKey(user, dto);
  }

  @Post('goals/:goalId/access-grants/:grantId/revocation/begin')
  beginEncryptedRevocation(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('grantId') grantId: string) {
    return this.sharingService.beginEncryptedRevocation(user.id, goalId, grantId);
  }

  @Put('goals/:goalId/access-grants/:grantId/revocation/commit')
  commitEncryptedRevocation(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('grantId') grantId: string, @Body() dto: CommitEncryptedRevocationDto) {
    return this.sharingService.commitEncryptedRevocation(user.id, goalId, grantId, dto);
  }

  @Post('goals/:goalId/access-grants/:grantId/revocation/fail')
  failEncryptedRevocation(@CurrentUser() user: AuthenticatedUser, @Param('goalId') goalId: string, @Param('grantId') grantId: string, @Body() dto: FailEncryptedRevocationDto) {
    return this.sharingService.failEncryptedRevocation(user.id, goalId, grantId, dto.rotationId, dto.errorCode);
  }

  @Get('admin/sharing-key')
  getOwnSharingKey(@CurrentUser() user: AuthenticatedUser) {
    return this.sharingService.getOwnSharingKey(user);
  }

  @Get('sharing/staff/:userId/key')
  getStaffKey(@Param('userId') userId: string) {
    return this.sharingService.getActiveSharingKey(userId);
  }
}
