import type { Prisma } from "@/generated/prisma/client";
import { currentUserWithRole } from "@/lib/permissions";

type UserWithRole = Awaited<ReturnType<typeof currentUserWithRole>>;

// Who sees and hands out which leads. Same "see everything" switch as deals
// (canViewAllDeals): without it a rep sees leads they own plus any lead
// they've been given a task on (otherwise a manager could hand them a call
// they can't open). Assigning a lead or a task to someone else is a
// manager's call (canManageTeam); everyone else can only take it
// themselves. Put `where` inside an AND with any other OR filter, since it
// carries its own OR.
export async function leadAccess(user?: UserWithRole): Promise<{
  where: Prisma.LeadWhereInput;
  canViewAll: boolean;
  canAssign: boolean;
  userId: string;
}> {
  const u = user ?? (await currentUserWithRole());
  const canViewAll = Boolean(u.role?.canViewAllDeals);
  const canAssign = Boolean(u.role?.canManageTeam);
  return {
    where: canViewAll ? {} : { OR: [{ ownerId: u.id }, { tasks: { some: { assigneeId: u.id } } }] },
    canViewAll,
    canAssign,
    userId: u.id,
  };
}
