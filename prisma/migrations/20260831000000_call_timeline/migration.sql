-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_dealId_idx" ON "Call"("dealId");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing LocalCaptureToken rows are all single-use tokens that are either
-- already burned or long expired (this table only ever holds short-lived
-- tokens) — clearing them is safe and avoids needing to backfill a callId
-- for rows that predate the Call model.
DELETE FROM "LocalCaptureToken";

-- DropIndex (dealId is no longer unique — a deal can now have many calls,
-- and therefore many tokens issued over time)
DROP INDEX "LocalCaptureToken_dealId_key";

-- AlterTable
ALTER TABLE "LocalCaptureToken" ADD COLUMN "callId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LocalCaptureToken_callId_key" ON "LocalCaptureToken"("callId");

-- CreateIndex
CREATE INDEX "LocalCaptureToken_dealId_idx" ON "LocalCaptureToken"("dealId");

-- AddForeignKey
ALTER TABLE "LocalCaptureToken" ADD CONSTRAINT "LocalCaptureToken_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
