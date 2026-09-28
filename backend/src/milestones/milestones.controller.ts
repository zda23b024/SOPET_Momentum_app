import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestones.dto';
import { MilestonesService } from './milestones.service';

@UseGuards(JwtAuthGuard)
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly service: MilestonesService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query('goalId') goalId?: string) { return this.service.list(user.id, goalId); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMilestoneDto) { return this.service.create(user.id, dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMilestoneDto) { return this.service.update(user.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.remove(user.id, id); }
}
