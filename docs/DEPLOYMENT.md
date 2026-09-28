# SOPET Momentum deployment guide

## Supported topology

Deploy the Vite frontend to Vercel at `https://app.example.com` and the NestJS API to Railway at `https://api.example.com`. This is cross-origin but same-site (HTTPS sibling subdomains). Set `VITE_API_BASE_URL=https://api.example.com/api/v1` in Vercel and `FRONTEND_URL=https://app.example.com` in Railway. The API permits only that exact origin, and browser requests use credentialed cookies.

For this topology set `COOKIE_SECURE=true` and normally `COOKIE_SAME_SITE=strict`. Use `none` only if the frontend and API are on different registrable domains; it still requires HTTPS and exact CORS origin matching. Never use a wildcard origin with credentials.

## Railway API

Set `NODE_ENV=production`, `PORT` (Railway supplies it), `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=strict`, `TRUST_PROXY=true`, `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `EMAIL_API_KEY`, and optionally `GEMINI_API_KEY` with `AI_ENABLED=true`. Store all values in Railway variables or an approved secret manager. Set `ENABLE_SWAGGER=false`, `BOOTSTRAP_ADMIN_ENABLED=false`, `SEED_DEMO_USERS=false`, and leave development-memory-user variables unset.

Railway runs `npx prisma migrate deploy` and the production configuration check before starting. If this fails, do not bypass it with `prisma db push`, `migrate reset`, or manual schema changes.

## Vercel frontend

Set `VITE_APP_MODE=production` and `VITE_API_BASE_URL` as above for both Preview and Production. Do not put backend secrets, Resend keys, database URLs, or JWT secrets in Vercel frontend variables.

## Scheduled account deletion worker

Create a Railway cron/service invocation at least hourly that runs `npm run deletion:process-due`. The command uses a transaction-scoped PostgreSQL advisory lock for each deletion and atomically claims pending requests, preventing duplicate account deletion across concurrent workers. Locks release automatically on commit or rollback. Contended requests remain pending for a later scheduled run. Keep the API deployment separate from the worker schedule.

## Pre-release and rollback

1. Create a PostgreSQL backup/PITR point, verify Redis, Resend domain, DNS/TLS, Sentry/monitoring alert routing, and on-call ownership.
2. Run `npm ci` in both projects, Prisma validate/generate/migrate status, tests, builds, Playwright against staging, `npm run audit:verify`, and `npm audit --omit=dev --audit-level=high`.
3. Deploy a tagged, clean Git commit only. Keep the prior Railway/Vercel artifacts available for rollback.
4. If application rollback is needed, roll back application artifacts only. Never roll back a database migration without a reviewed recovery procedure; restore to an isolated database first and verify ciphertext, ownership isolation, and audit-chain integrity.

## External acceptance evidence

Before production approval, capture evidence for managed PostgreSQL backups/PITR restore, Upstash Redis limiting, Resend delivery on a verified domain, HTTPS/DNS, secret access control, Sentry error and alert delivery, privacy/log redaction, AI provider behavior, sharing/revocation, export, deletion worker, and an independent security review.
