# SOPET Momentum production release gate

Current classification: **TECHNICAL ALPHA**. Source-code foundations have been added, but production infrastructure and external verification are not complete.

## Latest code-controlled release evidence

- Audit actor identity is now immutable across user deletion; the staging historical audit stream was re-anchored to checkpoint `e769324f-d92a-4e8f-b0fd-3222c686ad7a` after the pre-immutability defect was identified. `npm run audit:verify` passes after a real synthetic-user create/login/delete journey.
- Vercel/Railway deployment topology, environment variables, migration sequencing, durable account-deletion worker invocation, rollback, and external acceptance evidence are documented in `docs/DEPLOYMENT.md`.

## Local verification, 2026-09-27

- Backend Jest: 15 suites and 54 tests passed; backend TypeScript build passed.
- Frontend TypeScript lint and Vite build passed.
- Frontend crypto tests (13) and AI consent tests (3) passed.
- Local Playwright smoke and staging-database authentication journeys passed after allowing up to 30 seconds for the anonymous auth check. The auth journey confirmed the `USER` role, HttpOnly auth cookie names/presence, post-login API access, settings, and logout.
- Profile and notification preferences are editable through owner-scoped API routes. MFA recovery-code regeneration and disable require the current password plus an authenticator or unused recovery code; disabling MFA revokes all sessions. A personal security-event list is available.
- The settings download is an **encrypted account archive**, not a complete decrypted portability export. It uses the existing recent-authentication gate and leaves protected records as ciphertext. Full client-side decrypted export and completeness review remain open.
- Kiswahili remains inactive until translations receive language and methodology review.

## Evidence still required before Production Ready

- [ ] Deployment builds, unit tests, and real browser E2E journeys pass in a provisioned environment.
- [ ] PostgreSQL migrations are applied with `npx prisma migrate deploy` and verified on a safe PostgreSQL environment. Do not use `prisma db push`, `migrate reset`, or `DROP DATABASE` in production.
- [ ] Redis distributed limiting, transactional email delivery, and production configuration check pass against real services.
- [ ] Privacy leakage test (`SOPET_PRIVACY_TEST_92F7X`) passes for database, network, logs, analytics, audit, and monitoring. NOT EXECUTED here because no test deployment was supplied.
- [ ] Audit-chain verification and cross-user export denial pass against PostgreSQL.
- [ ] Backup/restore exercise, monitoring alert routing, staging smoke test, deletion schedule verification, and dependency review pass.

## External/manual ownership items

Production hosting, PostgreSQL and Redis provisioning, DNS/domain/TLS, transactional-email account and domain verification, backup policy/schedule, monitoring credentials and alert ownership, secret storage, independent penetration test, Privacy Policy, Terms of Service, retention approval, and incident-response ownership remain external/manual and unverified.
