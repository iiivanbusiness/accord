-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "renewalDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "autoRenews" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "renewalNote" TEXT;
ALTER TABLE "Contract" ADD COLUMN "renewalReminderSentAt" TIMESTAMP(3);
