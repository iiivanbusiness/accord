-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN "canViewAllDeals" BOOLEAN NOT NULL DEFAULT false;

-- Every workspace's Owner role can see everything, same rationale as every
-- other permission backfill this session — nobody who already had full
-- visibility loses any of it just because scoped visibility now exists.
UPDATE "Role" SET "canViewAllDeals" = true WHERE "isOwner" = true;
