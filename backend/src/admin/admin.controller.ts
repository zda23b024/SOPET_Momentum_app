import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateManagedUserDto, UpdateManagedUserRoleDto } from './dto/managed-user.dto';

@ApiTags('Administration & Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'View high-level anonymous system metrics' })
  async getMetrics() {
    return await this.adminService.getSystemMetrics();
  }

  @Get('audit-logs')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'View recent tamper-evident audit logs (Security & Owner only)' })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLogs(@Query('limit') limit?: number) {
    return await this.adminService.getRecentAuditLogs(limit ? Number(limit) : 50);
  }

  @Get('security-events')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'View security events (brute force flags, session revokes)' })
  @ApiQuery({ name: 'limit', required: false })
  async getSecurityEvents(@Query('limit') limit?: number) {
    return await this.adminService.getRecentSecurityEvents(limit ? Number(limit) : 50);
  }

  @Get('users')
  @Roles('OWNER')
  @ApiOperation({ summary: 'List accounts and roles (Owner only)' })
  async listUsers() {
    return this.adminService.listUsers();
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
