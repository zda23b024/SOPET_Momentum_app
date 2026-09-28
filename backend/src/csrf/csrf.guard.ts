import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.constants';
import { CsrfService } from './csrf.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    const expectedOrigin = new URL(this.config.get<string>('frontendUrl') || 'http://localhost:3000').origin;
    const origin = req.headers.origin;
    if (!origin || origin !== expectedOrigin) {
      throw new ForbiddenException({ code: 'CSRF_ORIGIN_REJECTED', message: 'Request origin is not trusted.' });
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const header = req.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(header) ? header[0] : header;
    if (!this.csrf.matches(cookieToken, headerToken)) {
      throw new ForbiddenException({ code: 'CSRF_TOKEN_INVALID', message: 'CSRF validation failed.' });
    }
    return true;
  }
}

