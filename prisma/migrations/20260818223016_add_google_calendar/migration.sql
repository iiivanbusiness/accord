-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "googleAccessToken" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "googleTokenExpiresAt" DATETIME;
ALTER TABLE "Workspace" ADD COLUMN "googleAccountEmail" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "googleEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_googleEventId_key" ON "CalendarEvent"("googleEventId");
