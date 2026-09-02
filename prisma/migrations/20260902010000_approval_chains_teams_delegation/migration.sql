-- CreateTable: Team
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_workspaceId_name_key" ON "Team"("workspaceId", "name");

ALTER TABLE "Team" ADD CONSTRAINT "Team_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: User.teamId
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Deal.teamId
ALTER TABLE "Deal" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ApprovalChain
CREATE TABLE "ApprovalChain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "minDealValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalChain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalChain_workspaceId_order_key" ON "ApprovalChain"("workspaceId", "order");

ALTER TABLE "ApprovalChain" ADD CONSTRAINT "ApprovalChain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalChain" ADD CONSTRAINT "ApprovalChain_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: every workspace that currently has ApprovalStep rows
-- gets one "Default" chain (matches any team, any value — the same
-- unconditional behavior the single global chain always had).
INSERT INTO "ApprovalChain" ("id", "workspaceId", "name", "teamId", "minDealValue", "order", "createdAt")
SELECT gen_random_uuid()::text, s."workspaceId", 'Default', NULL, NULL, 0, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "workspaceId" FROM "ApprovalStep") s;

-- AlterTable: ApprovalStep — repoint from workspaceId to chainId
ALTER TABLE "ApprovalStep" ADD COLUMN "chainId" TEXT;

UPDATE "ApprovalStep" s
SET "chainId" = c."id"
FROM "ApprovalChain" c
WHERE c."workspaceId" = s."workspaceId" AND c."name" = 'Default';

ALTER TABLE "ApprovalStep" ALTER COLUMN "chainId" SET NOT NULL;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "ApprovalChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "ApprovalStep_workspaceId_order_key";
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_workspaceId_fkey";
ALTER TABLE "ApprovalStep" DROP COLUMN "workspaceId";

CREATE UNIQUE INDEX "ApprovalStep_chainId_order_key" ON "ApprovalStep"("chainId", "order");

-- AlterTable: ContractApproval.decidedOnBehalfOfUserId
ALTER TABLE "ContractApproval" ADD COLUMN "decidedOnBehalfOfUserId" TEXT;
ALTER TABLE "ContractApproval" ADD CONSTRAINT "ContractApproval_decidedOnBehalfOfUserId_fkey" FOREIGN KEY ("decidedOnBehalfOfUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ApprovalDelegate
CREATE TABLE "ApprovalDelegate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDelegate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalDelegate_fromUserId_idx" ON "ApprovalDelegate"("fromUserId");
CREATE INDEX "ApprovalDelegate_toUserId_idx" ON "ApprovalDelegate"("toUserId");

ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
