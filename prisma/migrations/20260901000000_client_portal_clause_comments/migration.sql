-- AlterTable
ALTER TABLE "Client" ADD COLUMN "portalToken" TEXT;
CREATE UNIQUE INDEX "Client_portalToken_key" ON "Client"("portalToken");

-- CreateTable
CREATE TABLE "ClauseComment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clauseTitle" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClauseComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClauseComment_contractId_idx" ON "ClauseComment"("contractId");

-- AddForeignKey
ALTER TABLE "ClauseComment" ADD CONSTRAINT "ClauseComment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
