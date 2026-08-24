"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendSignedNotificationEmail } from "@/lib/email";

export async function signContract(contractId: string, formData: FormData) {
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signatureImage = String(formData.get("signatureImage") ?? "").trim();
  if (!signerName) throw new Error("Name is required");
  if (!signatureImage) throw new Error("Draw your signature before signing");

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: { status: "signed", signedAt: new Date(), signerName, signerIp: ip, signatureImage },
    include: { deal: { include: { workspace: { include: { users: true } } } }, template: true },
  });

  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "signed" } });

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

  redirect(`/sign/${contractId}`);
}
