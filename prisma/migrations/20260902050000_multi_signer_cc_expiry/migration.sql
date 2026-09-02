-- AlterTable: Workspace — configurable reminder cadence + optional expiry
ALTER TABLE "Workspace" ADD COLUMN "reminderIntervalDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Workspace" ADD COLUMN "signingExpiryDays" INTEGER;

-- AlterTable: Contract — CC recipients + expiry timestamp
ALTER TABLE "Contract" ADD COLUMN "ccEmails" TEXT;
ALTER TABLE "Contract" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateTable: ContractSigner
CREATE TABLE "ContractSigner" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "signatureImage" TEXT,
    "signerIp" TEXT,
    "declinedReason" TEXT,
    "signedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSigner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractSigner_token_key" ON "ContractSigner"("token");
CREATE UNIQUE INDEX "ContractSigner_contractId_order_key" ON "ContractSigner"("contractId", "order");
CREATE INDEX "ContractSigner_contractId_idx" ON "ContractSigner"("contractId");

ALTER TABLE "ContractSigner" ADD CONSTRAINT "ContractSigner_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
