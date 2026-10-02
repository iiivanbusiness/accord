"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { isValidDay, isValidTime, isValidTimeZone, TASK_PRIORITIES, TASK_TYPES } from "@/lib/tasks";

export type TaskInput = {
  assigneeId: string;
  type: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm or ""
  timezone: string;
  priority: string;
  note: string;
};

function clean(input: TaskInput) {
  if (!(TASK_TYPES as readonly string[]).includes(input.type)) throw new Error("Pick what kind of task this is");
  if (!isValidDay(input.dueDate)) throw new Error("Pick a day");
  if (input.dueTime && !isValidTime(input.dueTime)) throw new Error("That time doesn't look right");
  const priority = (TASK_PRIORITIES as readonly string[]).includes(input.priority) ? input.priority : "normal";
  return {
    type: input.type,
    dueDate: new Date(`${input.dueDate}T00:00:00Z`),
    dueTime: input.dueTime || null,
    timezone: isValidTimeZone(input.timezone) ? input.timezone : "UTC",
    priority,
    note: input.note.trim().slice(0, 1000) || null,
  };
}

async function activeMember(workspaceId: string, userId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { id: userId, workspaceId, deactivatedAt: null }, select: { id: true } });
  return u?.id ?? null;
}

// Bulk "Assign" from the lead list: one task per lead for one rep, and by
// default the rep becomes the lead's owner. Managers only.
export async function assignLeadTasks(input: TaskInput & { leadIds: string[]; makeOwner: boolean }): Promise<{ created: number }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!access.canAssign) throw new Error("Only managers can assign tasks to others");
  if (!Array.isArray(input.leadIds) || input.leadIds.length === 0) throw new Error("Pick at least one lead");
  if (input.leadIds.length > 1000) throw new Error("Assign up to 1,000 leads at a time");

  const task = clean(input);
  const assigneeId = await activeMember(workspace.id, input.assigneeId);
  if (!assigneeId) throw new Error("Pick who it's for");

  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id, id: { in: input.leadIds }, AND: [access.where] },
    select: { id: true },
  });
  const ids = leads.map((l) => l.id);
  if (ids.length === 0) throw new Error("None of those leads are available");

  await prisma.$transaction([
    prisma.task.createMany({
      data: ids.map((leadId) => ({ workspaceId: workspace.id, leadId, assigneeId, createdById: access.userId, ...task })),
    }),
    ...(input.makeOwner ? [prisma.lead.updateMany({ where: { id: { in: ids } }, data: { ownerId: assigneeId } })] : []),
  ]);

  revalidatePath("/leads");
  return { created: ids.length };
}

// One task on a lead, from the lead page. A rep can only give tasks to
// themselves.
export async function createLeadTask(leadId: string, input: TaskInput): Promise<void> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, AND: [access.where] }, select: { id: true } });
  if (!lead) throw new Error("Lead not found");

  const task = clean(input);
  const assigneeId = access.canAssign ? await activeMember(workspace.id, input.assigneeId) : access.userId;
  if (!assigneeId) throw new Error("Pick who it's for");

  await prisma.task.create({ data: { workspaceId: workspace.id, leadId, assigneeId, createdById: access.userId, ...task } });
  revalidatePath(`/leads/${leadId}`);
}

// Done, skipped, or back to open. The assignee can do this, and so can a
// manager (for a rep who's out, or a task that no longer applies).
export async function setTaskStatus(taskId: string, status: "open" | "done" | "skipped"): Promise<void> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!["open", "done", "skipped"].includes(status)) throw new Error("Unknown status");
  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId: workspace.id }, select: { id: true, assigneeId: true, leadId: true } });
  if (!task || (!access.canAssign && task.assigneeId !== access.userId)) throw new Error("Task not found");

  await prisma.task.update({ where: { id: task.id }, data: { status, completedAt: status === "open" ? null : new Date() } });
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
  revalidatePath("/today");
}

// Managers only: take a task off entirely.
export async function deleteTask(taskId: string): Promise<void> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!access.canAssign) throw new Error("Only managers can delete tasks");
  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId: workspace.id }, select: { id: true, leadId: true } });
  if (!task) throw new Error("Task not found");
  await prisma.task.delete({ where: { id: task.id } });
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
}
