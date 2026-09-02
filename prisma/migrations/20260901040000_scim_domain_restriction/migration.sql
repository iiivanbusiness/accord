-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "allowedEmailDomain" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "scimTokenHash" TEXT;
CREATE UNIQUE INDEX "Workspace_scimTokenHash_key" ON "Workspace"("scimTokenHash");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "scimExternalId" TEXT;
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
