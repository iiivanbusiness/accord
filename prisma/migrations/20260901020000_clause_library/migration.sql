-- CreateTable
CREATE TABLE "ClauseLibraryItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClauseLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClauseLibraryItem_workspaceId_idx" ON "ClauseLibraryItem"("workspaceId");

-- AddForeignKey
ALTER TABLE "ClauseLibraryItem" ADD CONSTRAINT "ClauseLibraryItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
