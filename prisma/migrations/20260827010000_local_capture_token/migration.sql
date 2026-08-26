-- CreateTable
CREATE TABLE "LocalCaptureToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalCaptureToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalCaptureToken_dealId_key" ON "LocalCaptureToken"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalCaptureToken_tokenHash_key" ON "LocalCaptureToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LocalCaptureToken_workspaceId_idx" ON "LocalCaptureToken"("workspaceId");

-- AddForeignKey
ALTER TABLE "LocalCaptureToken" ADD CONSTRAINT "LocalCaptureToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
