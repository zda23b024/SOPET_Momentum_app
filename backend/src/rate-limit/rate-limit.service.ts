import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from '../security/security.service';
import * as net from 'net';
import * as tls from 'tls';

type Bucket = { count: number; reset: number };
const emailKey = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : 'anonymous';

@Injectable()
export class RateLimitService {
  private memory = new Map<string, Bucket>();
  constructor(private readonly config: ConfigService, private readonly security: SecurityService) {}
  private production() { return process.env.NODE_ENV === 'production'; }
  async check(endpoint: string, ip?: string, userId?: string, email?: unknown) {
    const limits: Record<string, [number, number]> = { register: [5, 3600], login: [10, 900], mfa: [8, 900], recovery: [8, 900], password: [5, 3600], ai: [20, 60], admin: [30, 60], sharing: [20, 60], privacy: [20, 60], export: [3, 3600] };
    const [max, ttl] = limits[endpoint] || [100, 60];
    const principal = userId ? `u:${userId}` : email ? `e:${emailKey(email)}` : `ip:${ip || 'unknown'}`;
    const key = `sopet:rl:${endpoint}:${principal}`;
    let result: { count: number; ttl: number };
    const redisUrl = this.config.get<string>('redis.url');
    if (redisUrl) result = await this.redisIncrement(redisUrl, key, ttl);
    else {
      if (this.production()) throw new ServiceUnavailableException('Rate limiting is unavailable');
      const now = Date.now(), old = this.memory.get(key); const bucket = !old || old.reset <= now ? { count: 0, reset: now + ttl * 1000 } : old;
      bucket.count++; this.memory.set(key, bucket); result = { count: bucket.count, ttl: Math.ceil((bucket.reset - now) / 1000) };
    }
    if (result.count > max) {
      await this.security.recordSecurityEvent({ userId, eventType: 'RATE_LIMIT_EXCEEDED', severity: 'MEDIUM', ipAddress: ip, details: { endpoint } });
      const error: any = new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS); error.retryAfter = result.ttl; throw error;
    }
  }
  async ping() { const url = this.config.get<string>('redis.url'); if (!url) return !this.production(); await this.redis(url, ['PING']); return true; }
  private async redisIncrement(url: string, key: string, ttl: number) {
    // Single atomic Redis operation prevents concurrent expiry races and avoids
    // security decisions spanning multiple transient connections.
    const script = "local c=redis.call('INCR',KEYS[1]);if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return tostring(c)..':'..tostring(redis.call('TTL',KEYS[1]))";
    const [count, remaining] = (await this.redis(url, ['EVAL', script, '1', key, String(ttl)])).split(':').map(Number);
    return { count, ttl: remaining || ttl };
  }
  private redis(url: string, args: string[]): Promise<string> {
    const parsed = new URL(url);
    // Upstash exposes TLS on its Redis endpoint; accept an accidentally omitted
    // `rediss` scheme there rather than downgrading credentials onto cleartext.
    const requiresTls = parsed.protocol === 'rediss:' || parsed.hostname.endsWith('.upstash.io');
    const port = Number(parsed.port || (requiresTls ? 6380 : 6379));
    const socket: net.Socket = requiresTls ? tls.connect({ host: parsed.hostname, port, servername: parsed.hostname }) : net.createConnection({ host: parsed.hostname, port });
    const auth = parsed.password ? (parsed.username ? ['AUTH', decodeURIComponent(parsed.username), decodeURIComponent(parsed.password)] : ['AUTH', decodeURIComponent(parsed.password)]) : [];
    const encode = (parts: string[]) => `*${parts.length}\r\n` + parts.map(v => `$${Buffer.byteLength(v)}\r\n${v}\r\n`).join('');
    const command = (auth.length ? encode(auth) : '') + encode(args);
    return new Promise((resolve, reject) => { let data = '', settled = false; const expectedResponses = auth.length ? 2 : 1;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); if (error) reject(error); else { const responses = data.split('\r\n').filter(Boolean); const failed = responses.find(response => response.startsWith('-')); const last = responses.at(-1) || ''; if (failed) reject(new Error(`Redis command failed: ${failed.slice(1, 120)}`)); else if (!last) reject(new Error('Redis command failed: empty response')); else resolve(last.replace(/^[:+]/, '')); } };
      const timer = setTimeout(() => finish(new Error('Redis timeout')), 3000);
      socket.once('error', err => finish(err)); socket.on('data', c => { data += c.toString(); if (data.split('\r\n').filter(Boolean).length >= expectedResponses) finish(); }); socket.on('end', () => finish()); socket.on('connect', () => { socket.write(command); }); });
  }
}
