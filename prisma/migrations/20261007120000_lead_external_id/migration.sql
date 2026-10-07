-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_externalId_key" ON "Lead"("workspaceId", "externalId");
