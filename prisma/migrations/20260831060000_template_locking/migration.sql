-- AlterTable
ALTER TABLE "Role" ADD COLUMN "canApproveTemplates" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContractTemplate" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractTemplate" ADD COLUMN "lockedByUserId" TEXT;
ALTER TABLE "ContractTemplate" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every workspace's Owner role gets canApproveTemplates too, same rationale
-- as the original role-system backfill: nobody who already had full control
-- over templates should lose any of it just because locking now exists.
UPDATE "Role" SET "canApproveTemplates" = true WHERE "isOwner" = true;
