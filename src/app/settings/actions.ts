"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

type ToggleField = "requireApproval" | "notifyOnSigned" | "autoRemind" | "zoomConnected" | "meetConnected";

export async function toggleWorkspaceFlag(field: ToggleField) {
  const workspace = await requireWorkspace();

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { [field]: !workspace[field] },
  });

  revalidatePath("/settings");
}

export async function updateWorkspaceName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const workspace = await requireWorkspace();

  await prisma.workspace.update({ where: { id: workspace.id }, data: { name } });
  revalidatePath("/settings");
}

export async function requestUpgrade(formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const workspace = await requireWorkspace();

  const existing = await prisma.upgradeRequest.findFirst({ where: { workspaceId: workspace.id, status: "pending" } });
  if (!existing) {
    await prisma.upgradeRequest.create({ data: { workspaceId: workspace.id, note } });
  }

  revalidatePath("/settings");
}
