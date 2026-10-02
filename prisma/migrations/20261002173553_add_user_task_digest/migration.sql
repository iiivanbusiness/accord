-- AlterTable
ALTER TABLE "User" ADD COLUMN     "taskDigestEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taskDigestSentOn" TEXT,
ADD COLUMN     "timezone" TEXT;

