import { Prisma } from "@/generated/prisma/client";
import { currentUserWithRole } from "@/lib/permissions";

type UserWithRole = Awaited<ReturnType<typeof currentUserWithRole>>;

// The Prisma where-clause fragment every deal read has to be AND-ed with —
// a role without canViewAllDeals only sees deals it started, plus any
// deal with no owner (everything that existed before ownership did, or a
// deal whose owner has since left and been set-null rather than
// reassigned). Spread this into a `where` alongside workspaceId; it's `{}`
// for a role that can see everything, so callers don't need an if/else.
// Pass an already-fetched user (e.g. a page that called currentUserWithRole
// itself for other reasons) to skip the redundant lookup.
export async function dealVisibilityFilter(
  user?: UserWithRole
): Promise<{ where: Prisma.DealWhereInput; canViewAll: boolean; userId: string }> {
  const u = user ?? (await currentUserWithRole());
  if (u.role?.canViewAllDeals) return { where: {}, canViewAll: true, userId: u.id };
  return { where: { OR: [{ ownerId: u.id }, { ownerId: null }] }, canViewAll: false, userId: u.id };
}
