import { createNotification } from "@/lib/notifications";
import { formatTaskDue } from "@/lib/tasks";

const TYPE_PHRASE: Record<string, [string, string]> = {
  cold_call: ["a cold call", "cold calls"],
  sales_call: ["a sales call", "sales calls"],
  follow_up: ["a follow-up", "follow-ups"],
  other: ["a task", "tasks"],
};

// In-app note to someone a manager just gave work to. Best-effort: the
// tasks are already saved, so a failure here is logged and swallowed.
export async function notifyTasksAssigned(o: {
  workspaceId: string;
  assigneeId: string;
  actorName: string;
  count: number;
  type: string;
  dueDate: Date;
  dueTime: string | null;
  lead?: { id: string; name: string };
}): Promise<void> {
  const [one, many] = TYPE_PHRASE[o.type] ?? TYPE_PHRASE.other;
  const what = o.count === 1 ? one : `${o.count.toLocaleString("en-US")} ${many}`;
  try {
    await createNotification({
      workspaceId: o.workspaceId,
      userId: o.assigneeId,
      type: "task.assigned",
      title: o.count === 1 && o.lead ? `New task: ${o.lead.name}` : `${o.count.toLocaleString("en-US")} new tasks`,
      body: `${o.actorName} gave you ${what} for ${formatTaskDue(o.dueDate, o.dueTime)}.`,
      linkUrl: o.count === 1 && o.lead ? `/leads/${o.lead.id}` : "/today",
    });
  } catch (err) {
    console.error("Failed to notify task assignee", err);
  }
}

export async function notifyTasksMoved(o: { workspaceId: string; recipientId: string; actorName: string; fromName: string | null; count: number }): Promise<void> {
  const n = o.count.toLocaleString("en-US");
  const tasks = o.count === 1 ? "task" : "tasks";
  try {
    await createNotification({
      workspaceId: o.workspaceId,
      userId: o.recipientId,
      type: "task.moved",
      title: `${n} ${tasks} moved to you`,
      body: o.fromName ? `${o.actorName} moved ${n} of ${o.fromName}'s ${tasks} to you.` : `${o.actorName} gave you ${n} unassigned ${tasks}.`,
      linkUrl: "/today",
    });
  } catch (err) {
    console.error("Failed to notify task recipient", err);
  }
}
