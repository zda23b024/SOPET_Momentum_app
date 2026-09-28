CREATE TYPE "GoalAccessPermission" AS ENUM ('VIEW', 'COMMENT', 'ASSIST', 'EDIT');
CREATE TYPE "GoalAccessGrantStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "GoalAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

CREATE TABLE "GoalAccessGrant" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "granteeUserId" TEXT NOT NULL,
  "granteeRoleSnapshot" "UserRoleType" NOT NULL,
  "permission" "GoalAccessPermission" NOT NULL DEFAULT 'VIEW',
  "status" "GoalAccessGrantStatus" NOT NULL DEFAULT 'PENDING',
  "supportPurpose" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "encryptedKeyEnvelope" TEXT,
  "encryptionMetadata" JSONB,
  "lastViewedAt" TIMESTAMP(3),
  CONSTRAINT "GoalAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoalAccessRequest" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "GoalAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "GoalAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSharingKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3),
  CONSTRAINT "AdminSharingKey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoalAccessGrant_goalId_status_idx" ON "GoalAccessGrant"("goalId", "status");
CREATE INDEX "GoalAccessGrant_granteeUserId_status_idx" ON "GoalAccessGrant"("granteeUserId", "status");
CREATE INDEX "GoalAccessGrant_ownerUserId_idx" ON "GoalAccessGrant"("ownerUserId");
CREATE INDEX "GoalAccessRequest_goalId_status_idx" ON "GoalAccessRequest"("goalId", "status");
CREATE INDEX "GoalAccessRequest_ownerUserId_status_idx" ON "GoalAccessRequest"("ownerUserId", "status");
CREATE INDEX "GoalAccessRequest_requesterId_status_idx" ON "GoalAccessRequest"("requesterId", "status");
CREATE UNIQUE INDEX "AdminSharingKey_userId_keyVersion_key" ON "AdminSharingKey"("userId", "keyVersion");
CREATE INDEX "AdminSharingKey_userId_isActive_idx" ON "AdminSharingKey"("userId", "isActive");

ALTER TABLE "GoalAccessGrant" ADD CONSTRAINT "GoalAccessGrant_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAccessGrant" ADD CONSTRAINT "GoalAccessGrant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAccessGrant" ADD CONSTRAINT "GoalAccessGrant_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAccessRequest" ADD CONSTRAINT "GoalAccessRequest_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAccessRequest" ADD CONSTRAINT "GoalAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAccessRequest" ADD CONSTRAINT "GoalAccessRequest_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSharingKey" ADD CONSTRAINT "AdminSharingKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
