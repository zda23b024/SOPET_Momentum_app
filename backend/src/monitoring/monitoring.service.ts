import { Injectable, Logger } from '@nestjs/common';
const blocked = /password|token|authorization|cookie|goal|action|barrier|review|vault|key|prompt/i;
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger('Monitoring');
  redact(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(v => this.redact(v));
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, blocked.test(k) ? '[REDACTED]' : this.redact(v)]));
    return input;
  }
  report(event: string, metadata: Record<string, unknown> = {}) { this.logger.warn(`MONITORING ${event} ${JSON.stringify(this.redact(metadata))}`); }
}
