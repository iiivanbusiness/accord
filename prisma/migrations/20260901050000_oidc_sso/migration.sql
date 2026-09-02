-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "ssoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "ssoIssuer" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "ssoClientId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "ssoClientSecret" TEXT;
