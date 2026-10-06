-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PhoneCall" ADD COLUMN "telnyxClientLegId" TEXT;
