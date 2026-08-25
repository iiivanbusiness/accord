"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function applyPlanChange(workspaceId: string, requestId: string | null, formData: FormData) {
  await requireAdmin();

  const plan = String(formData.get("plan") ?? "").trim();
  const callsLimit = Number(formData.get("callsLimit") ?? 0);
  if (!plan || !callsLimit || callsLimit < 1) throw new Error("Plan name and a valid call limit are required");

  await prisma.workspace.update({ where: { id: workspaceId }, data: { plan, callsLimit } });

  if (requestId) {
    await prisma.upgradeRequest.update({ where: { id: requestId }, data: { status: "resolved", resolvedAt: new Date() } });
  }

  revalidatePath("/admin");
}

export async function dismissUpgradeRequest(requestId: string) {
  await requireAdmin();
  await prisma.upgradeRequest.update({ where: { id: requestId }, data: { status: "resolved", resolvedAt: new Date() } });
  revalidatePath("/admin");
}
