-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "hubspotLeadFilter" JSONB,
ADD COLUMN     "hubspotLeadImport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hubspotLeadsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "hubspotWebhookSecret" TEXT,
ADD COLUMN     "salesforceLeadFilter" JSONB,
ADD COLUMN     "salesforceLeadImport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesforceLeadsSyncedAt" TIMESTAMP(3);

