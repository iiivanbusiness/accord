-- AlterTable
ALTER TABLE "PhoneCall" ADD COLUMN     "connected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'phone';

