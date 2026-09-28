import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE_NAME } from './csrf.constants';

@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService) {}

  issue(res: Response) {
    const token = randomBytes(32).toString('base64url');
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: this.config.get<boolean>('cookie.secure'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookie.sameSite'),
      path: '/',
      maxAge: 2 * 60 * 60 * 1000,
    });
    return token;
  }

  matches(cookieToken?: string, headerToken?: string) {
    if (!cookieToken || !headerToken) return false;
    const cookie = Buffer.from(cookieToken);
    const header = Buffer.from(headerToken);
    return cookie.length === header.length && timingSafeEqual(cookie, header);
  }
}
