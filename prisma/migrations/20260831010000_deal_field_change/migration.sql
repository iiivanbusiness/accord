-- CreateTable
CREATE TABLE "DealFieldChange" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "callId" TEXT,
    "sourceQuote" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealFieldChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealFieldChange_dealId_fieldKey_idx" ON "DealFieldChange"("dealId", "fieldKey");

-- AddForeignKey
ALTER TABLE "DealFieldChange" ADD CONSTRAINT "DealFieldChange_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFieldChange" ADD CONSTRAINT "DealFieldChange_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
