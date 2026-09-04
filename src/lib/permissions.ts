import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export type Permission = "canManageWorkspace" | "canManageTeam" | "canManageTemplates" | "canApproveContracts" | "canApproveTemplates";

// Every user has a role since the migration that introduced roles backfilled
// one onto every existing account — role is only ever actually null in the
// instant between a teammate being invited and someone assigning them one,
// which currentUserWithRole treats as "no permissions" rather than crashing.
export async function currentUserWithRole() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await currentUserWithRole();
  if (!user.role?.[permission]) throw new Error("You don't have permission to do that");
  return user;
}

// Every workspace needs exactly one isOwner role, created alongside it (see
// the Role model's doc comment) — full permissions, can't be deleted, so
// there's always at least one person who can manage the workspace even if
// every custom role gets deleted. Call this right after prisma.workspace.create
// at every signup path (credentials, Google OAuth, ...) and assign the
// founding user's roleId to the result — a workspace whose founder never
// gets this role can never create a role, invite a role-holding teammate,
// or reach any canManageTeam/canManageWorkspace setting, with no way back in
// short of a database edit.
export async function createOwnerRole(workspaceId: string) {
  return prisma.role.create({
    data: {
      workspaceId,
      name: "Owner",
      isOwner: true,
      canManageWorkspace: true,
      canManageTeam: true,
      canManageTemplates: true,
      canApproveContracts: true,
      canApproveTemplates: true,
      canViewAllDeals: true,
    },
  });
}
