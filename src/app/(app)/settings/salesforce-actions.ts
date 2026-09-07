"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function toggleSalesforce(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { id: user.workspaceId } });
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { salesforceEnabled: !workspace.salesforceEnabled } });
  revalidatePath("/settings");
}

export async function disconnectSalesforce(): Promise<void> {
  const user = await requirePermission("canManageWorkspace");
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      salesforceEnabled: false,
      salesforceAccessToken: null,
      salesforceRefreshToken: null,
      salesforceTokenExpiresAt: null,
      salesforceInstanceUrl: null,
      salesforceAccountEmail: null,
    },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "salesforce.disconnected" });

  revalidatePath("/settings");
}
