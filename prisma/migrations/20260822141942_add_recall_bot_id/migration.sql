ALTER TABLE "Deal" ADD COLUMN "recallBotId" TEXT;
CREATE UNIQUE INDEX "Deal_recallBotId_key" ON "Deal"("recallBotId");
