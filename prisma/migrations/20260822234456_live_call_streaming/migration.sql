ALTER TABLE "Deal" ADD COLUMN "liveTranscript" TEXT;
ALTER TABLE "Deal" ADD COLUMN "lastExtractedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "DealField_dealId_fieldKey_key" ON "DealField"("dealId", "fieldKey");
