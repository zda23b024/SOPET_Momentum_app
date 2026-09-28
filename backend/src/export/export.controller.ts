import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ExportService } from './export.service';
@Controller('export') @UseGuards(JwtAuthGuard)
export class ExportController { constructor(private readonly service: ExportService) {} @Get('me') @Header('Content-Type', 'application/json') exportMe(@CurrentUser() user: AuthenticatedUser) { return this.service.userExport(user.id); } }
