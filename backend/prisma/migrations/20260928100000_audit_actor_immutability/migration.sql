-- Keep the signed actor snapshot independent from the nullable User relation.
ALTER TABLE "AuditLog" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "hashVersion" INTEGER NOT NULL DEFAULT 2;

-- Existing rows retain their immutable actor value and gain a lookup relation.
UPDATE "AuditLog" SET "actorUserId" = "actorId" WHERE "actorId" IS NOT NULL;
UPDATE "AuditLog" SET "hashVersion" = 1;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
