-- CreateTable
CREATE TABLE "CallHighlight" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "callId" TEXT,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceQuote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallHighlight_dealId_idx" ON "CallHighlight"("dealId");

-- AddForeignKey
ALTER TABLE "CallHighlight" ADD CONSTRAINT "CallHighlight_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHighlight" ADD CONSTRAINT "CallHighlight_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
