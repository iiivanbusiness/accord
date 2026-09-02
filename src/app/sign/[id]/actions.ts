"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { notifyChangesRequested } from "@/lib/approval";
import { advanceSigningOrFinalize } from "@/lib/signing";

export async function signContract(contractId: string, formData: FormData) {
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signatureImage = String(formData.get("signatureImage") ?? "").trim();
  if (!signerName) throw new Error("Name is required");
  if (!signatureImage) throw new Error("Draw your signature before signing");

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";

  const [contractOk, ipOk] = await Promise.all([
    checkRateLimit(`sign:contract:${contractId}`, 10, 60 * 60 * 1000),
    checkRateLimit(`sign:ip:${ip}`, 20, 60 * 60 * 1000),
  ]);
  if (!contractOk || !ipOk) throw new Error("Too many attempts — try again later.");

  // updateMany with a status filter makes this atomic: a contract that's
  // already been signed, or has moved on to waiting for a counter-signer,
  // or a concurrent double-submit, can't overwrite the existing
  // signerName/signatureImage/signedAt — that's the legally significant
  // record, it shouldn't be replaceable after the fact. Only a contract
  // still sitting at "sent" (the client hasn't acted yet) can be signed.
  const result = await prisma.contract.updateMany({
    where: { id: contractId, status: "sent" },
    data: { signedAt: new Date(), signerName, signerIp: ip, signatureImage },
  });
  if (result.count === 0) {
    redirect(`/sign/${contractId}`);
  }

  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });

  await logAudit({
    workspaceId: (await prisma.deal.findUniqueOrThrow({ where: { id: contract.dealId }, select: { workspaceId: true } })).workspaceId,
    actorEmail: signerName,
    action: "contract.signed",
    targetType: "Contract",
    targetId: contract.id,
    ip,
  });

  // finalizeContractSigned (when nobody else needs to sign) or
  // notifying the next counter-signer (when someone does) both happen
  // here — the client's own signing action doesn't need to know which.
  await advanceSigningOrFinalize(contractId);

  redirect(`/sign/${contractId}`);
}

// A client leaving feedback on one specific clause before they've decided
// to sign — the "sign-or-nothing" gap. Reuses the changes_requested status
// (same one an internal approval rejection sets), so the contract page's
// existing "Send again" flow just works with no separate code path.
export async function requestClauseChange(contractId: string, clauseTitle: string, formData: FormData) {
  const comment = String(formData.get("comment") ?? "").trim();
  const fromName = String(formData.get("fromName") ?? "").trim() || "The client";
  if (!comment) throw new Error("Add a comment before sending");

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  const allowed = await checkRateLimit(`clause-comment:contract:${contractId}`, 10, 60 * 60 * 1000);
  if (!allowed) throw new Error("Too many requests — try again later.");

  const contract = await prisma.contract.findUnique({ where: { id: contractId }, include: { deal: true } });
  if (!contract) throw new Error("Not found");
  if (contract.status === "signed" || contract.status === "partially_signed" || contract.status === "expired") {
    throw new Error("This agreement can no longer be changed");
  }

  await prisma.clauseComment.create({ data: { contractId, clauseTitle, comment, fromName } });
  await prisma.contract.update({ where: { id: contractId }, data: { status: "changes_requested" } });
  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "changes_requested" } });

  await logAudit({
    workspaceId: contract.deal.workspaceId,
    actorEmail: fromName,
    action: "contract.clause_change_requested",
    targetType: "Contract",
    targetId: contractId,
    ip,
    metadata: { clauseTitle, comment },
  });

  await notifyChangesRequested(contract.dealId, fromName, `On "${clauseTitle}": ${comment}`);

  redirect(`/sign/${contractId}?feedbackSent=1`);
}
