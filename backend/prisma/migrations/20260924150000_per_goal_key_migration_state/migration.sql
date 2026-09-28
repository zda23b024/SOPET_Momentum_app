ALTER TABLE "Goal"
ADD COLUMN "privacyMigrationStatus" "PrivacyMigrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "privacyMigrationId" TEXT,
ADD COLUMN "privacyMigrationStartedAt" TIMESTAMP(3),
ADD COLUMN "privacyMigrationCompletedAt" TIMESTAMP(3),
ADD COLUMN "privacyMigrationError" TEXT;

UPDATE "Goal"
SET "privacyMigrationStatus" = 'COMPLETED',
    "privacyMigrationCompletedAt" = CURRENT_TIMESTAMP
WHERE "ownerWrappedGoalKey" IS NOT NULL;
