export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sopet_momentum?schema=public',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase() as 'lax' | 'strict' | 'none',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  redis: {
    url: process.env.REDIS_URL || '',
  },
  mail: {
    provider: process.env.EMAIL_PROVIDER || process.env.MAIL_PROVIDER || 'disabled',
    from: process.env.EMAIL_FROM || process.env.MAIL_FROM || 'noreply@sopet-momentum.org',
    resendApiKey: process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || '',
  },
});

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.BOOTSTRAP_ADMIN_ENABLED === 'true') throw new Error('Admin bootstrap is forbidden in production');
  if (process.env.SEED_DEMO_USERS === 'true') throw new Error('Demo users are forbidden in production');
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL', 'REDIS_URL', 'EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_API_KEY'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_ACCESS_SECRET!.length < 32 || process.env.JWT_REFRESH_SECRET!.length < 32 || /sopet_super_secure|change_in_production|default/i.test(process.env.JWT_ACCESS_SECRET! + process.env.JWT_REFRESH_SECRET!)) {
    throw new Error('Production JWT secrets must be at least 32 characters long');
  }
  if (/localhost|127\.0\.0\.1/i.test(process.env.FRONTEND_URL!)) throw new Error('Production FRONTEND_URL must not be localhost');
  if (!['lax', 'strict', 'none'].includes((process.env.COOKIE_SAME_SITE || 'lax').toLowerCase())) throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
  if ((process.env.COOKIE_SAME_SITE || '').toLowerCase() === 'none' && process.env.COOKIE_SECURE !== 'true') throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  if (process.env.EMAIL_PROVIDER !== 'resend') throw new Error('Production email requires EMAIL_PROVIDER=resend');
  if (process.env.DEMO_MODE === 'true') throw new Error('Demo mode is forbidden in production');
  if (process.env.AI_ENABLED === 'true' && !process.env.GEMINI_API_KEY) throw new Error('AI_ENABLED requires GEMINI_API_KEY');
}
