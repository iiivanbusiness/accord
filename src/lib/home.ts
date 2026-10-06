import { prisma } from "@/lib/db";
import { currentUserWithRole } from "@/lib/permissions";

// Where someone lands after signing in. In a workspace with prospecting
// everyone starts on Today, managers too: it opens on the one thing to do
// next. Without it, the Dashboard.
export async function homePath(): Promise<string> {
  try {
    const user = await currentUserWithRole();
    const workspace = await prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { prospectingEnabled: true } });
    return workspace?.prospectingEnabled ? "/today" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
