ALTER TABLE "GoalAccessGrant"
ADD COLUMN "revocationRotationId" TEXT,
ADD COLUMN "revocationStartedAt" TIMESTAMP(3),
ADD COLUMN "revocationError" TEXT;

CREATE INDEX "GoalAccessGrant_revocationRotationId_idx" ON "GoalAccessGrant"("revocationRotationId");
