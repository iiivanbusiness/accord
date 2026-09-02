-- AlterTable: Workspace — Slack
ALTER TABLE "Workspace" ADD COLUMN "slackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "slackTeamId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "slackTeamName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "slackAccessToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "slackChannelId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "slackChannelName" TEXT;

-- AlterTable: Workspace — HubSpot
ALTER TABLE "Workspace" ADD COLUMN "hubspotEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "hubspotPortalId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "hubspotAccessToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "hubspotRefreshToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "hubspotTokenExpiresAt" TIMESTAMP(3);

-- AlterTable: Client / Deal — HubSpot sync identifiers
ALTER TABLE "Client" ADD COLUMN "hubspotContactId" TEXT;
ALTER TABLE "Deal" ADD COLUMN "hubspotDealId" TEXT;
