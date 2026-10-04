-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "sandboxOfId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_sandboxOfId_key" ON "Workspace"("sandboxOfId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_sandboxOfId_fkey" FOREIGN KEY ("sandboxOfId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

