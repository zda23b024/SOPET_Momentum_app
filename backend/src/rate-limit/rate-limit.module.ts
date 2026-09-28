import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitInterceptor } from './rate-limit.interceptor';
@Global() @Module({ providers: [RateLimitService, RateLimitInterceptor], exports: [RateLimitService, RateLimitInterceptor] }) export class RateLimitModule {}
