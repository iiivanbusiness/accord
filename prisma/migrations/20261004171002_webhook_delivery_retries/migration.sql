-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "payload" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");


-- Deliveries from before retries existed were single attempts.
UPDATE "WebhookDelivery" SET "attempts" = 1, "status" = CASE WHEN "responseStatus" BETWEEN 200 AND 299 AND "error" IS NULL THEN 'delivered' ELSE 'failed' END, "deliveredAt" = CASE WHEN "responseStatus" BETWEEN 200 AND 299 AND "error" IS NULL THEN "createdAt" ELSE NULL END;
