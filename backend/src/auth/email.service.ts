import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');
  constructor(private readonly config: ConfigService) {}
  sendVerification(email: string, token: string) { const link = `${this.config.getOrThrow<string>('frontendUrl')}/?verifyEmailToken=${encodeURIComponent(token)}`; return this.send(email, 'Verify your SOPET Momentum email', `<p>Verify your SOPET Momentum email address:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours and can be used once.</p>`, link); }
  sendPasswordReset(email: string, token: string) { const link = `${this.config.getOrThrow<string>('frontendUrl')}/?resetPasswordToken=${encodeURIComponent(token)}`; return this.send(email, 'Reset your SOPET Momentum password', `<p>A password reset was requested for your SOPET Momentum account.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes and can be used once.</p>`); }
  sendPasswordChanged(email: string) { return this.send(email, 'Your SOPET Momentum password changed', '<p>Your SOPET Momentum password was changed and existing sessions were signed out.</p><p>If this was not you, contact support immediately.</p>'); }
  private async send(to: string, subject: string, html: string, developmentLink?: string) {
    const provider = this.config.get<string>('mail.provider') ?? 'disabled';
    if ((provider === 'disabled' || provider === 'console') && process.env.NODE_ENV !== 'production') {
      this.logger.log(`Development email for ${to}: ${subject}\n${html}`);
      return developmentLink;
    }
    if (provider !== 'resend') throw new ServiceUnavailableException('Configured email provider is unavailable');
    const apiKey = this.config.get<string>('mail.resendApiKey');
    if (!apiKey) throw new ServiceUnavailableException('Email provider credentials are missing');
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: this.config.getOrThrow<string>('mail.from'), to: [to], subject, html }) });
    if (!response.ok) throw new ServiceUnavailableException('Email delivery failed');
    return undefined;
  }
}
