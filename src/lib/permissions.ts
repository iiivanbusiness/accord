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
