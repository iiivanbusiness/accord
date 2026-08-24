"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { createSenderDomain, getSenderDomainStatus, removeSenderDomain } from "@/lib/sender-domain";
import { sendTeammateInviteEmail } from "@/lib/email";

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

export async function inviteTeammate(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) throw new Error("Enter an email address");

  const workspace = await requireWorkspace();
  const session = await auth();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.workspaceId === workspace.id) {
      throw new Error("They're already on this workspace");
    }
    throw new Error("That email is already tied to another SealMe workspace");
  }

  await prisma.user.create({
    data: { workspaceId: workspace.id, name: email, email, passwordHash: null },
  });

  try {
    await sendTeammateInviteEmail({
      to: email,
      inviterName: session?.user?.name ?? session?.user?.email ?? "A teammate",
      workspaceName: workspace.name,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`,
    });
  } catch (err) {
    console.error("Failed to send teammate invite email", err);
  }

  revalidatePath("/settings");
}

export async function removeTeammate(userId: string) {
  const workspace = await requireWorkspace();

  const count = await prisma.user.count({ where: { workspaceId: workspace.id } });
  if (count <= 1) throw new Error("Can't remove the only member of a workspace");

  await prisma.user.deleteMany({ where: { id: userId, workspaceId: workspace.id } });
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
