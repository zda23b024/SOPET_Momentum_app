import { CreateManagedUserDto, UpdateManagedUserRoleDto } from './dto/managed-user.dto';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequirePermissions, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ChangeUserRoleDto, SetAccountStatusDto } from './dto/admin.dto';

@ApiTags('Administration & Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@RequirePermissions('admin.dashboard.view')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @RequirePermissions('admin.dashboard.view', 'admin.metrics.view')
  getOverview() { return this.adminService.getOverview(); }

  @Get('users')
  @RequirePermissions('admin.dashboard.view', 'admin.users.view')
  getUsers(@Query('search') search?: string, @Query('role') role?: string, @Query('status') status?: string) {
    return this.adminService.getUsers(search, role, status);
  }

  @Patch('users/:userId/status')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.users.manage')
  setAccountStatus(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string, @Body() dto: SetAccountStatusDto) {
    return this.adminService.setAccountStatus(actor.id, userId, dto.isActive);
  }

  @Get('roles')
  @RequirePermissions('admin.dashboard.view', 'admin.users.view')
  getRoles() { return this.adminService.getRoles(); }

  @Post('users/:userId/roles')
  @Roles('OWNER')
  @RequirePermissions('admin.dashboard.view', 'admin.roles.manage')
  changeUserRole(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string, @Body() dto: ChangeUserRoleDto) {
    return this.adminService.changeUserRole(actor.id, userId, dto);
  }

  @Get('deletions')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.deletions.view')
  getDeletions() { return this.adminService.getPendingDeletions(); }

  @Get('health')
  @RequirePermissions('admin.dashboard.view', 'admin.health.view')
  getHealth() { return this.adminService.getHealth(); }

  @Post('users/:userId/revoke-sessions')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'security.sessions.revoke')
  revokeSessions(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string) {
    return this.adminService.revokeUserSessions(actor.id, userId);
  }

  @Post('users/:userId/resend-verification')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.users.view')
  resendVerification(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string) {
    return this.adminService.resendUserVerification(actor.id, userId);
  }

  @Post('users/:userId/request-password-reset')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.users.view')
  requestPasswordReset(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string) {
    return this.adminService.requestUserPasswordReset(actor.id, userId);
  }

  @Get('metrics')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.metrics.view')
  @ApiOperation({ summary: 'View high-level anonymous system metrics' })
  async getMetrics() {
    return await this.adminService.getSystemMetrics();
  }

  @Get('audit-logs')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'admin.audit.view')
  @ApiOperation({ summary: 'View recent tamper-evident audit logs (Security & Owner only)' })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLogs(@Query('limit') limit?: number) {
    return await this.adminService.getRecentAuditLogs(limit ? Number(limit) : 50);
  }

  @Get('security-events')
  @Roles('OWNER', 'ADMIN')
  @RequirePermissions('admin.dashboard.view', 'security.events.view')
  @ApiOperation({ summary: 'View security events (brute force flags, session revokes)' })
  @ApiQuery({ name: 'limit', required: false })
  async getSecurityEvents(@Query('limit') limit?: number) {
    return await this.adminService.getRecentSecurityEvents(limit ? Number(limit) : 50);
  }


  @Post('users')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create a user, admin, or owner account (Owner only)' })
  async createUser(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateManagedUserDto) {
    return this.adminService.createManagedUser(actor, dto);
  }

  @Patch('users/:userId/role')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Change an account role (Owner only)' })
  async updateUserRole(@CurrentUser() actor: AuthenticatedUser, @Param('userId') userId: string, @Body() dto: UpdateManagedUserRoleDto) {
    return this.adminService.updateManagedUserRole(actor, userId, dto.role);
  }
}
