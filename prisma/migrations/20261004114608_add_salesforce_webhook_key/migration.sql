-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "salesforceWebhookKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_salesforceWebhookKey_key" ON "Workspace"("salesforceWebhookKey");

