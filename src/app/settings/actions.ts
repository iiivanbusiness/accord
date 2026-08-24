"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { createSenderDomain, getSenderDomainStatus, removeSenderDomain } from "@/lib/sender-domain";

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

export async function connectSenderDomain(formData: FormData) {
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const mailbox = String(formData.get("mailbox") ?? "hello").trim().toLowerCase() || "hello";
  if (!domain) throw new Error("Enter a domain");

  const workspace = await requireWorkspace();
  const created = await createSenderDomain(domain);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      senderDomain: domain,
      senderDomainId: created.id,
      senderDomainStatus: created.status,
      senderEmail: `${mailbox}@${domain}`,
    },
  });

  revalidatePath("/settings");
}

export async function checkSenderDomainVerification() {
  const workspace = await requireWorkspace();
  if (!workspace.senderDomainId) return;

  const status = await getSenderDomainStatus(workspace.senderDomainId);
  await prisma.workspace.update({ where: { id: workspace.id }, data: { senderDomainStatus: status.status } });

  revalidatePath("/settings");
}

export async function disconnectSenderDomain() {
  const workspace = await requireWorkspace();
  if (workspace.senderDomainId) {
    try {
      await removeSenderDomain(workspace.senderDomainId);
    } catch {
      // already gone on Resend's side — fine, still clear our local state
    }
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { senderDomain: null, senderDomainId: null, senderDomainStatus: null, senderEmail: null },
  });

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
