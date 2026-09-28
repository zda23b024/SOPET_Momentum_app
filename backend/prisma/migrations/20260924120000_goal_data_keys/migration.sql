ALTER TABLE "Goal"
ADD COLUMN "ownerWrappedGoalKey" JSONB,
ADD COLUMN "goalKeyVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AdminSharingKey"
ADD COLUMN "wrappedPrivateKey" JSONB,
ADD COLUMN "privateKeyMetadata" JSONB;
