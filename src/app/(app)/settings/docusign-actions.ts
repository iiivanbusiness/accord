"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function toggleDocusign(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { id: user.workspaceId } });
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { docusignEnabled: !workspace.docusignEnabled } });
  revalidatePath("/settings");
}

export async function disconnectDocusign(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      docusignEnabled: false,
      docusignAccessToken: null,
      docusignRefreshToken: null,
      docusignTokenExpiresAt: null,
      docusignAccountId: null,
      docusignBaseUri: null,
      docusignAccountEmail: null,
    },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "docusign.disconnected" });

  revalidatePath("/settings");
}
