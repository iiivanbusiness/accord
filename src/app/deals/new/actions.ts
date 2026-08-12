"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function createDeal(formData: FormData) {
  const clientName = String(formData.get("clientName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim() || clientName;
  const email = String(formData.get("email") ?? "").trim() || null;
  const service = String(formData.get("service") ?? "").trim();
  const feeDisplay = String(formData.get("feeDisplay") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "") || null;

  if (!clientName || !service || !feeDisplay) {
    throw new Error("Client, service, and fee are required");
  }

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  const client = await prisma.client.create({
    data: { workspaceId: workspace.id, name: clientName, company, email },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      templateId,
      service,
      feeDisplay,
      status: "ready",
      source: "upload",
      fields: {
        create: [
          { groupLabel: "Client & engagement", label: "Client", fieldKey: "clientName", value: clientName, status: "confirmed", orderIndex: 0 },
          { groupLabel: "Client & engagement", label: "Service", fieldKey: "service", value: service, status: "confirmed", orderIndex: 1 },
          { groupLabel: "Commercial terms", label: "Fee", fieldKey: "fee", value: feeDisplay, status: "confirmed", orderIndex: 2 },
        ],
      },
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  redirect(`/deals/${deal.id}`);
}
