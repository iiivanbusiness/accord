import { prisma } from "@/lib/db";
import { currentUserWithRole } from "@/lib/permissions";

// Where someone lands after signing in. Reps in a workspace with
// prospecting start on Today (their calls for the day); managers, and
// everyone else, start on the Dashboard.
export async function homePath(): Promise<string> {
  try {
    const user = await currentUserWithRole();
    if (user.role?.canManageTeam) return "/dashboard";
    const workspace = await prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { prospectingEnabled: true } });
    return workspace?.prospectingEnabled ? "/today" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
