CREATE TYPE "ContentEncoding" AS ENUM ('PLAINTEXT', 'CLIENT_ENCRYPTED');
CREATE TYPE "PrivacyMigrationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

ALTER TABLE "User" RENAME COLUMN "privacyMode" TO "defaultPrivacyMode";
ALTER TABLE "User" ADD COLUMN "privacyMigrationStatus" "PrivacyMigrationStatus" NOT NULL DEFAULT 'NOT_STARTED';

ALTER TABLE "Goal" ALTER COLUMN "title" DROP NOT NULL, ADD COLUMN "privacyMode" "PrivacyMode" NOT NULL DEFAULT 'STANDARD_PRIVATE', ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Milestone" ALTER COLUMN "title" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Action" ALTER COLUMN "title" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NMARecord" ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ReadinessAssessment" ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Barrier" ALTER COLUMN "userExplanation" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ActionIntervention" ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MMA" ALTER COLUMN "title" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Interruption" ALTER COLUMN "causeDescription" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Restart" ALTER COLUMN "whatChanged" DROP NOT NULL, ALTER COLUMN "rootCause" DROP NOT NULL, ALTER COLUMN "restartActionTitle" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "KPI" ALTER COLUMN "name" DROP NOT NULL, ALTER COLUMN "unit" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "KPIValue" ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WeeklyReview" ALTER COLUMN "meaningfulProgress" DROP NOT NULL, ALTER COLUMN "actionsThatMattered" DROP NOT NULL, ALTER COLUMN "whatGotInTheWay" DROP NOT NULL, ALTER COLUMN "nextNmaTitle" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Lesson" ALTER COLUMN "lessonText" DROP NOT NULL, ALTER COLUMN "adjustmentText" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Adjustment" ALTER COLUMN "description" DROP NOT NULL, ADD COLUMN "contentEncoding" "ContentEncoding" NOT NULL DEFAULT 'PLAINTEXT', ADD COLUMN "plaintextContent" JSONB, ADD COLUMN "encryptedPayload" JSONB, ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AIInteractionMetadata" ADD COLUMN "userId" TEXT, ADD COLUMN "goalId" TEXT, ADD COLUMN "fieldsShared" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ALTER COLUMN "userConsentGiven" SET DEFAULT false;

ALTER TABLE "EncryptionKeyMetadata" ADD COLUMN "keyVersion" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "wrappingAlgorithm" TEXT NOT NULL DEFAULT 'AES-KW', ADD COLUMN "kdf" TEXT NOT NULL DEFAULT 'PBKDF2', ADD COLUMN "hash" TEXT NOT NULL DEFAULT 'SHA-256', ADD COLUMN "metadataVersion" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "recoveryWrappedKeyData" TEXT, ADD COLUMN "recoverySalt" TEXT, ADD COLUMN "recoveryIterations" INTEGER NOT NULL DEFAULT 600000, ADD COLUMN "recoveryConfigured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "EncryptionKeyMetadata" SET "recoveryWrappedKeyData" = '', "recoverySalt" = '' WHERE "recoveryWrappedKeyData" IS NULL;
ALTER TABLE "EncryptionKeyMetadata" ALTER COLUMN "recoveryWrappedKeyData" SET NOT NULL, ALTER COLUMN "recoverySalt" SET NOT NULL;
CREATE UNIQUE INDEX "EncryptionKeyMetadata_userId_keyVersion_key" ON "EncryptionKeyMetadata"("userId", "keyVersion");

-- Existing records remain STANDARD_PRIVATE. Browser-driven upgrades atomically replace
-- their legacy plaintext with encryptedPayload and clear every private legacy column.
