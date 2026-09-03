-- AlterTable: Workspace — DocuSign OAuth connection
ALTER TABLE "Workspace" ADD COLUMN "docusignEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "docusignAccessToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "docusignRefreshToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "docusignTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "docusignAccountId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "docusignBaseUri" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "docusignAccountEmail" TEXT;

-- AlterTable: Contract — delivery method + envelope id
ALTER TABLE "Contract" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'sealme';
ALTER TABLE "Contract" ADD COLUMN "docusignEnvelopeId" TEXT;
