import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// The single source of truth for "which workspace is this request for" —
// every workspace-scoped query should go through this instead of
// prisma.workspace.findFirst(), which would silently mix tenants' data.
export async function requireWorkspace() {
  const session = await auth();
  if (!session?.user?.workspaceId) throw new Error("Not authenticated");
  const workspace = await prisma.workspace.findUnique({ where: { id: session.user.workspaceId } });
  if (!workspace) throw new Error("Workspace not found");
  return workspace;
}

export async function requireWorkspaceId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.workspaceId) throw new Error("Not authenticated");
  return session.user.workspaceId;
}
