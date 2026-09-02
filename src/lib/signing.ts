import { prisma } from "@/lib/db";
import { sendSignedNotificationEmail, sendCountersignRequestEmail } from "@/lib/email";
import { extractRenewalTerms } from "@/lib/extract-renewal";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { notifySlack } from "@/lib/slack";
import { syncDealToHubspot } from "@/lib/hubspot";
import { logAudit } from "@/lib/audit";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

// Called once every REQUIRED signature is in — whether that's just the
// client (the common case, zero ContractSigner rows) or the client plus
// every counter-signer after them. Fires all the same "the deal is done"
// effects regardless of which signer completed it last, so a contract
// with counter-signers behaves identically to today's single-signer one
// from here on — the only difference is how many people had to sign to
// get here.
export async function finalizeContractSigned(contractId: string): Promise<void> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { deal: { include: { client: true, workspace: { include: { users: true } } } }, template: true },
  });

  await prisma.contract.update({ where: { id: contractId }, data: { status: "signed" } });
  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "signed" } });

  await logAudit({
    workspaceId: contract.deal.workspaceId,
    action: "contract.signed",
    targetType: "Contract",
    targetId: contract.id,
  });

  if (contract.deal.workspace.notifyOnSigned) {
    try {
      await sendSignedNotificationEmail({
        to: contract.deal.workspace.users.map((u) => u.email),
        clientName: contract.signerName ?? contract.deal.client.name,
        templateName: contract.template?.name ?? "contract",
        contractUrl: `${appUrl()}/deals/${contract.dealId}/contract`,
      });
    } catch (err) {
      console.error("Failed to send signed-notification email", err);
    }
  }

  try {
    await extractRenewalTerms(contract.id);
  } catch (err) {
    console.error("Failed to extract renewal terms", err);
  }

  await dispatchWebhookEvent(contract.deal.workspaceId, "contract.signed", {
    dealId: contract.dealId,
    contractId: contract.id,
    clientName: contract.deal.client.name,
    signerName: contract.signerName,
    signedAt: new Date().toISOString(),
  });
  await notifySlack(contract.deal.workspaceId, {
    type: "contract.signed",
    dealId: contract.dealId,
    clientName: contract.deal.client.name,
    signerName: contract.signerName ?? contract.deal.client.name,
  });
  await syncDealToHubspot(contract.deal.workspaceId, contract.dealId);
}

// Called right after ANY signer (the client, or a counter-signer) signs.
// If someone's still pending in the routing order, notifies whoever's
// next and leaves the contract "partially_signed"; otherwise finalizes.
// Returns the resulting status so the caller can render accordingly.
export async function advanceSigningOrFinalize(contractId: string): Promise<"partially_signed" | "signed"> {
  const nextSigner = await prisma.contractSigner.findFirst({
    where: { contractId, status: "pending" },
    orderBy: { order: "asc" },
  });

  if (!nextSigner) {
    await finalizeContractSigned(contractId);
    return "signed";
  }

  await prisma.contract.update({ where: { id: contractId }, data: { status: "partially_signed" } });

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { deal: { include: { client: true, workspace: true } }, template: true },
  });

  try {
    await sendCountersignRequestEmail({
      to: nextSigner.email,
      signerName: nextSigner.name,
      clientName: contract.deal.client.name,
      templateName: contract.template?.name ?? "contract",
      signLink: `${appUrl()}/sign/${contract.id}/countersign/${nextSigner.token}`,
      workspaceName: contract.deal.workspace.name,
      verifiedSenderEmail: contract.deal.workspace.senderDomainStatus === "verified" ? contract.deal.workspace.senderEmail : null,
    });
    await prisma.contractSigner.update({ where: { id: nextSigner.id }, data: { notifiedAt: new Date() } });
  } catch (err) {
    console.error(`Failed to notify next signer for contract ${contractId}`, err);
  }

  return "partially_signed";
}
