# SOPET Momentum backup and restore runbook

## Backup policy

Use the managed PostgreSQL provider's automated backups and point-in-time recovery where available. Enable encrypted backups, restrict backup and restore access to the production operations group, and set retention according to the approved organizational retention policy. Redis is not the system of record; its rate-limit keys need no backup.

Encrypted SOPET records remain ciphertext in PostgreSQL backups. Privacy Vault passphrases, recovery keys, and unwrapped user keys must never be collected by backend operators or backup tooling.

## Restoration procedure

1. Create an isolated, access-restricted test database; never restore a production backup over a live database.
2. Restore a selected backup/PITR point into that isolated instance.
3. Set a test-only `DATABASE_URL`, run `npx prisma migrate deploy`, and run read-only integrity checks including `AuditService.verifyChain()`.
4. Verify row counts, user ownership isolation, encrypted payload ciphertext, and a representative standard-private export. Do not decrypt users' encrypted content.
5. Record recovery time, selected recovery point, validation results, and securely dispose of the isolated instance according to retention policy.

BACKUP RESTORE TEST: NOT EXECUTED (no safe test PostgreSQL instance was supplied).

## Audit history re-anchor procedure

Audit records are immutable. The `AuditLog.actorId` field is an immutable actor snapshot; `actorUserId` is a nullable operational lookup that may be removed when an account is deleted. Do not edit either audit field directly.

If a pre-immutability deployment contains already-invalid audit hashes, stop audit-producing traffic, preserve a database backup, review the affected records, and run the one-time checkpoint operation with `AUDIT_REANCHOR_CONFIRMED=true npm run audit:reanchor`. This deliberately treats all existing records as historical data protected by a new legacy digest checkpoint. Immediately run `npm run audit:verify` and record the checkpoint ID, backup reference, operator, and result. Do not use this procedure to conceal tampering or on a healthy chain.
