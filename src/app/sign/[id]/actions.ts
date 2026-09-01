"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendSignedNotificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { extractRenewalTerms } from "@/lib/extract-renewal";
import { notifyChangesRequested } from "@/lib/approval";

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

  // updateMany with status filter makes this atomic: a contract that's
  // already signed (or a concurrent double-submit) can't overwrite the
  // existing signerName/signatureImage/signedAt — that's the legally
  // significant record, it shouldn't be replaceable after the fact.
  const result = await prisma.contract.updateMany({
    where: { id: contractId, status: { not: "signed" } },
    data: { status: "signed", signedAt: new Date(), signerName, signerIp: ip, signatureImage },
  });
  if (result.count === 0) {
    redirect(`/sign/${contractId}`);
  }

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { deal: { include: { workspace: { include: { users: true } } } }, template: true },
  });

  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "signed" } });
  await logAudit({
    workspaceId: contract.deal.workspaceId,
    actorEmail: signerName,
    action: "contract.signed",
    targetType: "Contract",
    targetId: contract.id,
    ip,
  });

  if (contract.deal.workspace.notifyOnSigned) {
    try {
      await sendSignedNotificationEmail({
        to: contract.deal.workspace.users.map((u) => u.email),
        clientName: signerName,
        templateName: contract.template?.name ?? "contract",
        contractUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/deals/${contract.dealId}/contract`,
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
  if (contract.status === "signed") throw new Error("This agreement is already signed");

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
