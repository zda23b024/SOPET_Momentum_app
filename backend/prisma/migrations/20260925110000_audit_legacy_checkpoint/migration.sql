CREATE TABLE "AuditCheckpoint" (
  "id" TEXT NOT NULL,
  "cutoverTimestamp" TIMESTAMP(3) NOT NULL,
  "legacyRecordCount" INTEGER NOT NULL,
  "lastLegacyAuditId" TEXT,
  "legacyDigest" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditCheckpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditCheckpoint_cutoverTimestamp_idx" ON "AuditCheckpoint"("cutoverTimestamp");
ALTER TABLE "AuditLog" ADD COLUMN "legacyCheckpointId" TEXT;
CREATE INDEX "AuditLog_legacyCheckpointId_idx" ON "AuditLog"("legacyCheckpointId");
