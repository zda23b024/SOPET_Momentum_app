# Staging readiness

Staging must use a separate PostgreSQL database, Redis instance, transactional-email test account/domain, and preferably a separate AI key. Use synthetic users and data only—never routine production private data. Apply migrations with `npx prisma migrate deploy`, run smoke tests for auth, sharing, export, encrypted save, readiness, and audit-chain verification before release.
