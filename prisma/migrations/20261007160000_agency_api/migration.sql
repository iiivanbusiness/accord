-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaign" TEXT;

-- AlterTable
ALTER TABLE "PhoneCall" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_workspaceId_campaign_idx" ON "Lead"("workspaceId", "campaign");

-- CreateIndex
CREATE INDEX "PhoneCall_workspaceId_updatedAt_idx" ON "PhoneCall"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCall_workspaceId_externalId_key" ON "PhoneCall"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_updatedAt_idx" ON "Task"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_externalId_key" ON "Task"("workspaceId", "externalId");

