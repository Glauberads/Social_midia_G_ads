-- CreateEnum
CREATE TYPE "SocialConnectionErrorCategory" AS ENUM ('TRANSIENT_ERROR', 'RATE_LIMITED', 'EXPIRED', 'REVOKED', 'PERMISSION_ERROR', 'INVALID_RESPONSE');

-- AlterTable
ALTER TABLE "social_connections" ADD COLUMN "lastRefreshAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastRefreshSuccessAt" TIMESTAMP(3),
ADD COLUMN "nextRefreshAt" TIMESTAMP(3),
ADD COLUMN "refreshFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingLockedUntil" TIMESTAMP(3),
ADD COLUMN "lastErrorAt" TIMESTAMP(3),
ADD COLUMN "lastErrorCategory" "SocialConnectionErrorCategory";
