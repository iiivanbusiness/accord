-- DropForeignKey
ALTER TABLE "ApprovalChain" DROP CONSTRAINT "ApprovalChain_teamId_fkey";

-- DropForeignKey
ALTER TABLE "ApprovalChain" DROP CONSTRAINT "ApprovalChain_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_chainId_fkey";

-- DropForeignKey
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_roleId_fkey";

-- DropForeignKey
ALTER TABLE "ContractApproval" DROP CONSTRAINT "ContractApproval_contractId_fkey";

-- DropForeignKey
ALTER TABLE "ContractApproval" DROP CONSTRAINT "ContractApproval_decidedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ContractApproval" DROP CONSTRAINT "ContractApproval_decidedOnBehalfOfUserId_fkey";

-- DropForeignKey
ALTER TABLE "ContractApproval" DROP CONSTRAINT "ContractApproval_roleId_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canApproveContracts";

-- DropTable
DROP TABLE "ApprovalChain";

-- DropTable
DROP TABLE "ApprovalStep";

-- DropTable
DROP TABLE "ContractApproval";

-- CreateTable
CREATE TABLE "ReviewChain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "minDealValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewChainStep" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewChainStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewStep" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedOnBehalfOfUserId" TEXT,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "dueReminderSentAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "ReviewStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewChecklistItem" (
    "id" TEXT NOT NULL,
    "reviewStepId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "reviewStepId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewChain_workspaceId_order_key" ON "ReviewChain"("workspaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewChainStep_chainId_order_key" ON "ReviewChainStep"("chainId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewStep_contractId_order_key" ON "ReviewStep"("contractId", "order");

-- CreateIndex
CREATE INDEX "ReviewChecklistItem_reviewStepId_idx" ON "ReviewChecklistItem"("reviewStepId");

-- CreateIndex
CREATE INDEX "ReviewComment_reviewStepId_createdAt_idx" ON "ReviewComment"("reviewStepId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");

-- AddForeignKey
ALTER TABLE "ReviewChain" ADD CONSTRAINT "ReviewChain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewChain" ADD CONSTRAINT "ReviewChain_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewChainStep" ADD CONSTRAINT "ReviewChainStep_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ReviewChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewChainStep" ADD CONSTRAINT "ReviewChainStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewStep" ADD CONSTRAINT "ReviewStep_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewStep" ADD CONSTRAINT "ReviewStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewStep" ADD CONSTRAINT "ReviewStep_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewStep" ADD CONSTRAINT "ReviewStep_decidedOnBehalfOfUserId_fkey" FOREIGN KEY ("decidedOnBehalfOfUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewChecklistItem" ADD CONSTRAINT "ReviewChecklistItem_reviewStepId_fkey" FOREIGN KEY ("reviewStepId") REFERENCES "ReviewStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reviewStepId_fkey" FOREIGN KEY ("reviewStepId") REFERENCES "ReviewStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

