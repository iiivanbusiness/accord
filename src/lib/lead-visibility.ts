import type { Prisma } from "@/generated/prisma/client";
import { currentUserWithRole } from "@/lib/permissions";

type UserWithRole = Awaited<ReturnType<typeof currentUserWithRole>>;

// Who sees and hands out which leads. Same "see everything" switch as deals
// (canViewAllDeals): without it a rep only sees leads they own. Assigning a
// lead to someone else is a manager's call (canManageTeam); everyone else
// can only take a lead themselves. Spread `where` into every lead query
// alongside workspaceId.
export async function leadAccess(user?: UserWithRole): Promise<{
  where: Prisma.LeadWhereInput;
  canViewAll: boolean;
  canAssign: boolean;
  userId: string;
}> {
  const u = user ?? (await currentUserWithRole());
  const canViewAll = Boolean(u.role?.canViewAllDeals);
  const canAssign = Boolean(u.role?.canManageTeam);
  return { where: canViewAll ? {} : { ownerId: u.id }, canViewAll, canAssign, userId: u.id };
}
