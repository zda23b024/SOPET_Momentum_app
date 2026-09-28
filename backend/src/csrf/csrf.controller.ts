import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/roles.decorator';
import { CsrfService } from './csrf.service';

@Controller('auth')
export class CsrfController {
  constructor(private readonly csrf: CsrfService) {}

  @Public()
  @Get('csrf-token')
  token(@Res({ passthrough: true }) res: Response) {
    return { csrfToken: this.csrf.issue(res) };
  }
}

