ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "Workspace" ADD COLUMN "senderDomain" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "senderDomainId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "senderDomainStatus" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "senderEmail" TEXT;
