"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendSignedNotificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { extractRenewalTerms } from "@/lib/extract-renewal";

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
