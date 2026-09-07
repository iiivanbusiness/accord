-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "salesforceContactId" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "salesforceOpportunityId" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "salesforceAccessToken" TEXT,
ADD COLUMN     "salesforceAccountEmail" TEXT,
ADD COLUMN     "salesforceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesforceInstanceUrl" TEXT,
ADD COLUMN     "salesforceRefreshToken" TEXT,
ADD COLUMN     "salesforceTokenExpiresAt" TIMESTAMP(3);
