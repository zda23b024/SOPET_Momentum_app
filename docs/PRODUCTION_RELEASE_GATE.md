# SOPET Momentum production release gate

Current classification: **TECHNICAL ALPHA**. Source-code foundations have been added, but production infrastructure and external verification are not complete.

## Evidence still required before Production Ready

- [ ] Deployment builds, unit tests, and real browser E2E journeys pass in a provisioned environment.
- [ ] PostgreSQL migrations are applied with `npx prisma migrate deploy` and verified on a safe PostgreSQL environment. Do not use `prisma db push`, `migrate reset`, or `DROP DATABASE` in production.
- [ ] Redis distributed limiting, transactional email delivery, and production configuration check pass against real services.
- [ ] Privacy leakage test (`SOPET_PRIVACY_TEST_92F7X`) passes for database, network, logs, analytics, audit, and monitoring. NOT EXECUTED here because no test deployment was supplied.
- [ ] Audit-chain verification and cross-user export denial pass against PostgreSQL.
- [ ] Backup/restore exercise, monitoring alert routing, staging smoke test, deletion schedule verification, and dependency review pass.

## External/manual ownership items

Production hosting, PostgreSQL and Redis provisioning, DNS/domain/TLS, transactional-email account and domain verification, backup policy/schedule, monitoring credentials and alert ownership, secret storage, independent penetration test, Privacy Policy, Terms of Service, retention approval, and incident-response ownership remain external/manual and unverified.
