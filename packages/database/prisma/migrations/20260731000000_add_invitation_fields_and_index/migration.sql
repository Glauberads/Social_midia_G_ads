-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN "acceptedById" UUID;
ALTER TABLE "Invitation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
