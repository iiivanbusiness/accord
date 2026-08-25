import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Both the layout (AppShell) and several individual pages need the plain
// workspace record. React's cache() dedupes calls with the same argument
// within a single request, so this only hits the DB once per request no
// matter how many places call requireWorkspace() — each cross-Atlantic
// round trip to Neon is expensive enough that this is worth doing.
const getWorkspaceById = cache((workspaceId: string) => prisma.workspace.findUnique({ where: { id: workspaceId } }));

// The single source of truth for "which workspace is this request for" —
// every workspace-scoped query should go through this instead of
// prisma.workspace.findFirst(), which would silently mix tenants' data.
//
// Redirects to /login rather than throwing: a session can be present-but-stale
// (e.g. an old JWT issued before workspaceId was added to the token, or a
// workspace that no longer exists) and that should look like "please sign in
// again," not a 500.
export async function requireWorkspace() {
  const workspaceId = await requireWorkspaceId();
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) redirect("/login");
  return workspace;
}

export async function requireWorkspaceId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  return session.user.workspaceId;
}
