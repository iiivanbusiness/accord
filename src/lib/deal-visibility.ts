import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { currentUserWithRole } from "@/lib/permissions";

type UserWithRole = Awaited<ReturnType<typeof currentUserWithRole>>;

// The Prisma where-clause fragment every deal read has to be AND-ed with —
// a role without canViewAllDeals only sees deals it started, plus any
// deal with no owner (everything that existed before ownership did, or a
// deal whose owner has since left and been set-null rather than
// reassigned), plus any deal whose contract has a review step assigned to
// them (or to someone who's actively delegated their reviews to them) —
// otherwise sending a deal to a teammate for review would route them to a
// page they're not allowed to open, and the review would sit "pending"
// forever with no way for them to act on it. Spread this into a `where`
// alongside workspaceId; it's `{}` for a role that can see everything, so
// callers don't need an if/else. Pass an already-fetched user (e.g. a page
// that called currentUserWithRole itself for other reasons) to skip the
// redundant lookup.
export async function dealVisibilityFilter(
  user?: UserWithRole
): Promise<{ where: Prisma.DealWhereInput; canViewAll: boolean; userId: string }> {
  const u = user ?? (await currentUserWithRole());
  if (u.role?.canViewAllDeals) return { where: {}, canViewAll: true, userId: u.id };

  const now = new Date();
  const delegations = await prisma.approvalDelegate.findMany({
    where: { toUserId: u.id, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { fromUserId: true },
  });
  const reviewerIds = [u.id, ...delegations.map((d) => d.fromUserId)];

  return {
    where: {
      OR: [
        { ownerId: u.id },
        { ownerId: null },
        { contract: { reviewSteps: { some: { assigneeId: { in: reviewerIds } } } } },
      ],
    },
    canViewAll: false,
    userId: u.id,
  };
}
