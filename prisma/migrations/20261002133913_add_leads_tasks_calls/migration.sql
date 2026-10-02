-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "allPartyStatePolicy" TEXT NOT NULL DEFAULT 'skip';

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "domain" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "interest" TEXT,
    "isDecisionMaker" BOOLEAN,
    "painPoints" TEXT,
    "objections" TEXT,
    "nextStep" TEXT,
    "nextStepAt" TIMESTAMP(3),
    "summary" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "importId" TEXT,
    "convertedClientId" TEXT,
    "convertedDealId" TEXT,
    "hubspotContactId" TEXT,
    "salesforceRecordId" TEXT,
    "salesforceRecordType" TEXT,
    "externalOwnerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cold_call',
    "leadId" TEXT,
    "dealId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "dueDate" DATE NOT NULL,
    "dueTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneCall" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "dealId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'recording',
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "consentState" TEXT,
    "consentRule" TEXT,
    "recorded" BOOLEAN NOT NULL DEFAULT false,
    "telnyxCallControlId" TEXT,
    "telnyxRecordingId" TEXT,
    "templateId" TEXT,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "summary" TEXT,
    "extracted" JSONB,
    "sttSeconds" INTEGER,
    "aiInputTokens" INTEGER,
    "aiOutputTokens" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PhoneCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallIntent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "mode" TEXT NOT NULL,
    "templateId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_workspaceId_ownerId_idx" ON "Lead"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_stage_idx" ON "Lead"("workspaceId", "stage");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_email_idx" ON "Lead"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_phone_idx" ON "Lead"("workspaceId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_hubspotContactId_key" ON "Lead"("workspaceId", "hubspotContactId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_salesforceRecordId_key" ON "Lead"("workspaceId", "salesforceRecordId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_assigneeId_status_dueDate_idx" ON "Task"("workspaceId", "assigneeId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "LeadImport_workspaceId_createdAt_idx" ON "LeadImport"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCall_telnyxCallControlId_key" ON "PhoneCall"("telnyxCallControlId");

-- CreateIndex
CREATE INDEX "PhoneCall_workspaceId_status_idx" ON "PhoneCall"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PhoneCall_userId_status_idx" ON "PhoneCall"("userId", "status");

-- CreateIndex
CREATE INDEX "PhoneCall_leadId_idx" ON "PhoneCall"("leadId");

-- CreateIndex
CREATE INDEX "CallIntent_userId_expiresAt_idx" ON "CallIntent"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LeadImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneCall" ADD CONSTRAINT "PhoneCall_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneCall" ADD CONSTRAINT "PhoneCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneCall" ADD CONSTRAINT "PhoneCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneCall" ADD CONSTRAINT "PhoneCall_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntent" ADD CONSTRAINT "CallIntent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntent" ADD CONSTRAINT "CallIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntent" ADD CONSTRAINT "CallIntent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

