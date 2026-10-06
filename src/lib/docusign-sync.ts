import { prisma } from "@/lib/db";
import { docusignEnvelopeStatus } from "@/lib/docusign";
import { finalizeContractSigned } from "@/lib/signing";
import { reportError } from "@/lib/error-report";

// A contract sent through DocuSign is marked signed once DocuSign itself
// says the envelope is completed, asked with the workspace's own DocuSign
// connection. Called when DocuSign's event arrives and by the daily cron,
// in case an event never does. Returns whether it's signed now.
export async function syncDocusignContract(contractId: string): Promise<boolean> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, status: true, docusignEnvelopeId: true, deal: { select: { workspaceId: true } } },
  });
  if (!contract?.docusignEnvelopeId) return false;
  if (contract.status === "signed") return true;

  const envelope = await docusignEnvelopeStatus(contract.deal.workspaceId, contract.docusignEnvelopeId);
  if (envelope.status !== "completed") return false;

  const primary = envelope.signers.find((s) => s.routingOrder === "1") ?? envelope.signers[0];
  await prisma.contract.update({
    where: { id: contract.id },
    data: { signerName: primary?.name ?? "Client", signedAt: primary?.signedDateTime ? new Date(primary.signedDateTime) : new Date() },
  });
  // DocuSign already has every recipient's signature (that's what
  // "completed" means); SealMe's own signer rows just follow.
  await prisma.contractSigner.updateMany({ where: { contractId: contract.id, status: "pending" }, data: { status: "signed", signedAt: new Date() } });
  await finalizeContractSigned(contract.id);
  return true;
}

// Daily: DocuSign contracts still out for signature from the last 60 days.
export async function syncPendingDocusignContracts(): Promise<number> {
  const pending = await prisma.contract.findMany({
    where: { status: "sent", docusignEnvelopeId: { not: null }, sentAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
    select: { id: true },
    take: 200,
  });
  let signed = 0;
  for (const c of pending) {
    try {
      if (await syncDocusignContract(c.id)) signed++;
    } catch (err) {
      await reportError(err, "DocuSign status check", { contractId: c.id });
    }
  }
  return signed;
}
