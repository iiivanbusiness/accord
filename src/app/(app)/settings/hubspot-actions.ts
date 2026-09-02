"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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
    data: { hubspotEnabled: false, hubspotPortalId: null, hubspotAccessToken: null, hubspotRefreshToken: null, hubspotTokenExpiresAt: null },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "hubspot.disconnected" });

  revalidatePath("/settings");
}
