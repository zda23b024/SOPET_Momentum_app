ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entryHash" TEXT;
CREATE INDEX "AuditLog_entryHash_idx" ON "AuditLog"("entryHash");
