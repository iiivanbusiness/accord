"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { validateHubspotToken } from "@/lib/hubspot";
import { logAudit } from "@/lib/audit";

export async function connectHubspot(formData: FormData): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const token = String(formData.get("token") ?? "").trim();
  if (!token) throw new Error("Paste your HubSpot Private App token first");

  const { portalId } = await validateHubspotToken(token);

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { hubspotAccessToken: token, hubspotPortalId: portalId, hubspotEnabled: true },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "hubspot.connected", metadata: { portalId } });

  revalidatePath("/settings");
}

export async function toggleHubspot(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { id: user.workspaceId } });
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { hubspotEnabled: !workspace.hubspotEnabled } });
  revalidatePath("/settings");
}

export async function disconnectHubspot(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { hubspotEnabled: false, hubspotPortalId: null, hubspotAccessToken: null },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "hubspot.disconnected" });

  revalidatePath("/settings");
}
