"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { currentUserWithRole, requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Self-service: anyone can hand their own approval authority to a
// teammate — no special permission needed, since it's their own authority
// they're delegating, same as forwarding your own email. This is the
// "I'm the only Legal approver and I'm going on leave" fix.
export async function createDelegation(formData: FormData) {
  const user = await currentUserWithRole();
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!toUserId) throw new Error("Choose who to delegate to");
  if (toUserId === user.id) throw new Error("Can't delegate to yourself");

  const toUser = await prisma.user.findFirst({ where: { id: toUserId, workspaceId: user.workspaceId } });
  if (!toUser) throw new Error("Teammate not found");

  const rawEndsAt = String(formData.get("endsAt") ?? "").trim();
  const endsAt = rawEndsAt ? new Date(rawEndsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Invalid end date");
  if (endsAt && endsAt.getTime() <= Date.now()) throw new Error("End date must be in the future");

  await prisma.approvalDelegate.create({
    data: { workspaceId: user.workspaceId, fromUserId: user.id, toUserId, endsAt },
  });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_delegate.created", metadata: { to: toUser.email, endsAt } });

  revalidatePath("/settings");
}

// The delegator themselves, or a canManageWorkspace admin (covering for
// someone who's unreachable — the whole point of a backup), can revoke.
export async function revokeDelegation(delegationId: string) {
  const user = await currentUserWithRole();
  const delegation = await prisma.approvalDelegate.findFirst({ where: { id: delegationId, workspaceId: user.workspaceId } });
  if (!delegation) throw new Error("Delegation not found");

  if (delegation.fromUserId !== user.id && !user.role?.canManageWorkspace) {
    throw new Error("Only the person who delegated, or a workspace admin, can revoke this");
  }

  await prisma.approvalDelegate.delete({ where: { id: delegationId } });

  const session = await auth();
  await logAudit({ workspaceId: user.workspaceId, actorEmail: session?.user?.email, action: "approval_delegate.revoked", targetId: delegationId });

  revalidatePath("/settings");
}

// Admin-only path: set up a delegation on someone else's behalf (HR
// covering an unplanned absence, where the absent person can't do it
// themselves).
export async function createDelegationForUser(fromUserId: string, formData: FormData) {
  const admin = await requirePermission("canManageWorkspace");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!toUserId) throw new Error("Choose who to delegate to");
  if (toUserId === fromUserId) throw new Error("Can't delegate to the same person");

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findFirst({ where: { id: fromUserId, workspaceId: admin.workspaceId } }),
    prisma.user.findFirst({ where: { id: toUserId, workspaceId: admin.workspaceId } }),
  ]);
  if (!fromUser || !toUser) throw new Error("Teammate not found");

  const rawEndsAt = String(formData.get("endsAt") ?? "").trim();
  const endsAt = rawEndsAt ? new Date(rawEndsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Invalid end date");

  await prisma.approvalDelegate.create({
    data: { workspaceId: admin.workspaceId, fromUserId, toUserId, endsAt },
  });

  const session = await auth();
  await logAudit({ workspaceId: admin.workspaceId, actorEmail: session?.user?.email, action: "approval_delegate.created", metadata: { from: fromUser.email, to: toUser.email, endsAt, byAdmin: true } });

  revalidatePath("/settings");
}
