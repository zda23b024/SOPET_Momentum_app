CREATE TABLE "AIConsentReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT,
  "purpose" TEXT NOT NULL,
  "fieldsShared" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIConsentReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIConsentReceipt_userId_createdAt_idx" ON "AIConsentReceipt"("userId", "createdAt");
