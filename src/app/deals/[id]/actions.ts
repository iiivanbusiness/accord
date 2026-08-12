"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function generateContract(dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { fields: true } });
  if (!deal) throw new Error("Deal not found");

  const missing = deal.fields.some((f) => f.status === "missing");
  if (missing) throw new Error("Cannot generate a contract while information is missing");

  await prisma.contract.upsert({
    where: { dealId },
    create: { dealId, templateId: deal.templateId, status: "draft" },
    update: {},
  });

  if (deal.status !== "sent" && deal.status !== "signed") {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "ready" } });
  }

  redirect(`/deals/${dealId}/contract`);
}

export async function sendToClient(dealId: string) {
  await prisma.contract.update({ where: { dealId }, data: { status: "sent", sentAt: new Date() } });
  await prisma.deal.update({ where: { id: dealId }, data: { status: "sent" } });
  redirect(`/deals/${dealId}/contract`);
}
