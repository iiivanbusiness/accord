"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { cookieTimeZone, dayInZone } from "@/lib/viewer-time";
import { currentUserWithRole } from "@/lib/permissions";
import { notifyTasksMoved } from "@/lib/task-notify";
import { dispatchLeadsUpdated } from "@/lib/webhook-events";

// "unassigned" stands for open tasks whose assignee's account was removed.
export type MoveTasksInput = { fromUserId: string; toUserId: string; scope: "all" | "due"; makeOwner: boolean };

// Hand one person's open tasks to someone else: everything, or just what's
// overdue or due today (someone out sick). Managers only.
export async function moveTasks(input: MoveTasksInput): Promise<{ moved: number }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!access.canAssign) throw new Error("Only managers can move tasks");
  if (input.fromUserId === input.toUserId) throw new Error("Pick someone else");

  const to = await prisma.user.findFirst({ where: { id: input.toUserId, workspaceId: workspace.id, deactivatedAt: null }, select: { id: true } });
  if (!to) throw new Error("Pick who gets them");
  // The person they come from may already be deactivated: moving work off
  // someone who left is the main reason to do this.
  const fromId = input.fromUserId === "unassigned" ? null : input.fromUserId;
  const from = fromId ? await prisma.user.findFirst({ where: { id: fromId, workspaceId: workspace.id }, select: { id: true, name: true } }) : null;
  if (fromId && !from) throw new Error("Teammate not found");

  const today = dayInZone(new Date(), await cookieTimeZone());
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      assigneeId: fromId,
      status: "open",
      ...(input.scope === "due" ? { dueDate: { lte: new Date(`${today}T00:00:00Z`) } } : {}),
    },
    select: { id: true, leadId: true },
  });
  if (tasks.length === 0) return { moved: 0 };

  const leadIds = [...new Set(tasks.map((t) => t.leadId).filter((id): id is string => Boolean(id)))];
  const handedOver = input.makeOwner && leadIds.length && to.id !== fromId
    ? await prisma.lead.findMany({ where: { id: { in: leadIds }, workspaceId: workspace.id, ownerId: fromId }, select: { id: true } })
    : [];
  await prisma.$transaction([
    prisma.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { assigneeId: to.id } }),
    // Only leads the old person owned change hands; someone else's lead
    // keeps its owner even if the old person had a task on it.
    ...(input.makeOwner && leadIds.length
      ? [prisma.lead.updateMany({ where: { id: { in: leadIds }, workspaceId: workspace.id, ownerId: fromId }, data: { ownerId: to.id } })]
      : []),
  ]);
  await dispatchLeadsUpdated(workspace.id, handedOver.map((l) => ({ leadId: l.id, changed: ["owner"], previousStage: null })));

  if (to.id !== access.userId) {
    const actor = await currentUserWithRole();
    await notifyTasksMoved({ workspaceId: workspace.id, recipientId: to.id, actorName: actor.name, fromName: from?.name ?? null, count: tasks.length });
  }

  revalidatePath("/team");
  return { moved: tasks.length };
}
