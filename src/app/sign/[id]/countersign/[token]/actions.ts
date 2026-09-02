"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { notifyChangesRequested } from "@/lib/approval";
import { advanceSigningOrFinalize } from "@/lib/signing";

export async function signAsCountersigner(contractId: string, token: string, formData: FormData) {
  const signatureImage = String(formData.get("signatureImage") ?? "").trim();
  if (!signatureImage) throw new Error("Draw your signature before signing");

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  const allowed = await checkRateLimit(`countersign:${token}`, 10, 60 * 60 * 1000);
  if (!allowed) throw new Error("Too many attempts — try again later.");

  const signer = await prisma.contractSigner.findFirst({ where: { contractId, token } });
  if (!signer) throw new Error("Not found");

  // Same atomic-guard pattern as the client's own signContract — a
  // pending-only filter means a double-submit or an already-decided
  // signer can't overwrite the record.
  const result = await prisma.contractSigner.updateMany({
    where: { id: signer.id, status: "pending" },
    data: { status: "signed", signedAt: new Date(), signatureImage, signerIp: ip },
  });
  if (result.count === 0) {
    redirect(`/sign/${contractId}/countersign/${token}`);
  }

  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId }, include: { deal: true } });
  await logAudit({
    workspaceId: contract.deal.workspaceId,
    actorEmail: signer.email,
    action: "contract.countersigned",
    targetType: "Contract",
    targetId: contractId,
    ip,
    metadata: { signerName: signer.name, role: signer.role },
  });

  await advanceSigningOrFinalize(contractId);

  redirect(`/sign/${contractId}/countersign/${token}`);
}

export async function declineToSign(contractId: string, token: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  const allowed = await checkRateLimit(`countersign-decline:${token}`, 10, 60 * 60 * 1000);
  if (!allowed) throw new Error("Too many attempts — try again later.");

  const signer = await prisma.contractSigner.findFirst({ where: { contractId, token } });
  if (!signer) throw new Error("Not found");

  const result = await prisma.contractSigner.updateMany({
    where: { id: signer.id, status: "pending" },
    data: { status: "declined", declinedReason: reason || null },
  });
  if (result.count === 0) {
    redirect(`/sign/${contractId}/countersign/${token}`);
  }

  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
  await prisma.contract.update({ where: { id: contractId }, data: { status: "changes_requested" } });
  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "changes_requested" } });

  await logAudit({
    workspaceId: (await prisma.deal.findUniqueOrThrow({ where: { id: contract.dealId }, select: { workspaceId: true } })).workspaceId,
    actorEmail: signer.email,
    action: "contract.countersign_declined",
    targetType: "Contract",
    targetId: contractId,
    ip,
    metadata: { signerName: signer.name, reason },
  });

  await notifyChangesRequested(contract.dealId, signer.name, reason ? `Declined to sign: ${reason}` : "Declined to sign");

  redirect(`/sign/${contractId}/countersign/${token}`);
}
