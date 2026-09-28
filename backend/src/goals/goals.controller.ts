import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalStatusDto, UpgradeGoalPrivacyDto } from './dto/goals.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CommitGoalKeyMigrationDto, FailGoalKeyMigrationDto } from './dto/goal-key-migration.dto';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List all goals belonging to authenticated user' })
  async getGoals(@CurrentUser() user: AuthenticatedUser) {
    return await this.goalsService.getGoals(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific goal by ID with strict ownership validation' })
  async getGoalById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return await this.goalsService.getGoalById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new meaningful goal' })
  async createGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ) {
    return await this.goalsService.createGoal(user.id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update goal status with historical record (ACTIVE, PAUSED, COMPLETED)' })
  async updateGoalStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGoalStatusDto,
  ) {
    return await this.goalsService.updateGoalStatus(user.id, id, dto);
  }

  @Get('privacy-migrations')
  async listLegacyKeyMigrations(@CurrentUser() user: AuthenticatedUser) {
    return this.goalsService.listLegacyKeyMigrations(user.id);
  }

  @Post(':id/privacy-migration/begin')
  async beginGoalKeyMigration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.goalsService.beginGoalKeyMigration(user.id, id);
  }

  @Put(':id/privacy-migration/commit')
  async commitGoalKeyMigration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CommitGoalKeyMigrationDto) {
    return this.goalsService.commitGoalKeyMigration(user.id, id, dto);
  }

  @Post(':id/privacy-migration/fail')
  async failGoalKeyMigration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FailGoalKeyMigrationDto) {
    return this.goalsService.failGoalKeyMigration(user.id, id, dto.migrationId, dto.errorCode);
  }

  @Patch(':id/privacy')
  @ApiOperation({ summary: 'Atomically upgrade a goal from plaintext to browser-encrypted storage' })
  async upgradePrivacy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpgradeGoalPrivacyDto) {
    return this.goalsService.upgradePrivacy(user.id, id, dto);
  }
}
