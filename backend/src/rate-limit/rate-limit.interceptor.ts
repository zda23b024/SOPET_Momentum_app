import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { RateLimitService } from './rate-limit.service';
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly limiter: RateLimitService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = context.switchToHttp().getRequest(); const p = req.path || req.url || '';
    const endpoint = p.includes('register') ? 'register' : p.includes('login') ? 'login' : p.includes('mfa') ? 'mfa' : p.includes('forgot') || p.includes('reset') || p.includes('resend') ? 'password' : p.includes('/ai') ? 'ai' : p.includes('/admin') || p.includes('/security') ? 'admin' : p.includes('sharing') ? 'sharing' : p.includes('privacy') ? 'privacy' : p.includes('export') ? 'export' : 'general';
    return from(this.limiter.check(endpoint, req.ip || req.socket?.remoteAddress, req.user?.id, req.body?.email)).pipe(mergeMap(() => next.handle()));
  }
}
