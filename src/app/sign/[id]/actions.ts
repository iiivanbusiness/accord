"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

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
  });

  await prisma.deal.update({ where: { id: contract.dealId }, data: { status: "signed" } });

  redirect(`/sign/${contractId}`);
}
