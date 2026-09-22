-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "aiChatMessagesLimit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "aiChatMessagesUsedThisMonth" INTEGER NOT NULL DEFAULT 0;
