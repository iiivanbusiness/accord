"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { requirePermission } from "@/lib/permissions";
import { createSenderDomain, getSenderDomainStatus, removeSenderDomain } from "@/lib/sender-domain";
import { sendTeammateInviteEmail, sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

type ToggleField = "requireApproval" | "notifyOnSigned" | "autoRemind" | "zoomConnected" | "meetConnected";

export async function toggleWorkspaceFlag(field: ToggleField) {
  await requirePermission("canManageWorkspace");
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

  await requirePermission("canManageWorkspace");
  const workspace = await requireWorkspace();

  await prisma.workspace.update({ where: { id: workspace.id }, data: { name } });
  revalidatePath("/settings");
}

export async function connectSenderDomain(formData: FormData) {
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const mailbox = String(formData.get("mailbox") ?? "hello").trim().toLowerCase() || "hello";
  if (!domain) throw new Error("Enter a domain");

  await requirePermission("canManageWorkspace");
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
  await requirePermission("canManageWorkspace");
  const workspace = await requireWorkspace();
  if (!workspace.senderDomainId) return;

  const status = await getSenderDomainStatus(workspace.senderDomainId);
  await prisma.workspace.update({ where: { id: workspace.id }, data: { senderDomainStatus: status.status } });

  revalidatePath("/settings");
}

export async function disconnectSenderDomain() {
  await requirePermission("canManageWorkspace");
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

  await requirePermission("canManageTeam");
  const workspace = await requireWorkspace();
  const session = await auth();

  if (workspace.allowedEmailDomain && !email.endsWith(`@${workspace.allowedEmailDomain}`)) {
    throw new Error(`This workspace only accepts @${workspace.allowedEmailDomain} email addresses`);
  }

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
  await logAudit({
    workspaceId: workspace.id,
    actorEmail: session?.user?.email,
    action: "teammate.invited",
    metadata: { invitedEmail: email },
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
  await requirePermission("canManageTeam");
  const workspace = await requireWorkspace();
  const session = await auth();

  const count = await prisma.user.count({ where: { workspaceId: workspace.id } });
  if (count <= 1) throw new Error("Can't remove the only member of a workspace");

  const removed = await prisma.user.findFirst({ where: { id: userId, workspaceId: workspace.id } });
  await prisma.user.deleteMany({ where: { id: userId, workspaceId: workspace.id } });
  await logAudit({
    workspaceId: workspace.id,
    actorEmail: session?.user?.email,
    action: "teammate.removed",
    metadata: { removedEmail: removed?.email },
  });
  revalidatePath("/settings");
}

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

export async function uploadLogo(formData: FormData) {
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) throw new Error("Choose an image file");
  if (!file.type.startsWith("image/")) throw new Error("That's not an image file");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Keep the logo under 1.5MB");

  await requirePermission("canManageWorkspace");
  const workspace = await requireWorkspace();
  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

  await prisma.workspace.update({ where: { id: workspace.id }, data: { logoImage: dataUrl } });
  revalidatePath("/settings");
}

export async function removeLogo() {
  await requirePermission("canManageWorkspace");
  const workspace = await requireWorkspace();
  await prisma.workspace.update({ where: { id: workspace.id }, data: { logoImage: null } });
  revalidatePath("/settings");
}

export async function resendVerificationEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;

  const allowed = await checkRateLimit(`resend-verify:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
  if (!allowed) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return;

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  try {
    await sendVerificationEmail({
      to: email,
      verifyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verify-email/${rawToken}`,
    });
  } catch (err) {
    console.error("Failed to resend verification email", err);
  }
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

export async function updateAllowedDomain(formData: FormData) {
  const raw = String(formData.get("domain") ?? "").trim().toLowerCase();
  const domain = raw.replace(/^@/, "") || null;
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error("That doesn't look like a domain, e.g. acme.com");
  }

  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { allowedEmailDomain: domain } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "workspace.domain_restriction_updated", metadata: { domain } });

  revalidatePath("/settings");
}

// Returns the raw token exactly once — only the hash is ever stored, same
// pattern as every other long-lived credential in this app. Generating a
// new one immediately invalidates whatever the IdP was using before, so
// this is also how a leaked token gets revoked: generate a fresh one.
export async function generateScimToken(): Promise<string> {
  const user = await requirePermission("canManageWorkspace");
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { scimTokenHash: tokenHash } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "workspace.scim_token_generated" });

  revalidatePath("/settings");
  return rawToken;
}

export async function revokeScimToken(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { scimTokenHash: null } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "workspace.scim_token_revoked" });

  revalidatePath("/settings");
}
