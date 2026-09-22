import { prisma } from "@/lib/db";

// Plain insert, called from server code (notifyStepAssignee, the overdue
// review cron) — never throws to its caller's caller in a way that blocks
// the state change that already happened; callers wrap this in their own
// try/catch, same as every other "nudge" in this codebase (see
// notifyStepAssignee). Deliberately NOT a "use server" action — it takes a
// raw userId with no ownership check, so it must only ever be called from
// trusted server code, never reachable from the client.
export async function createNotification(options: {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      workspaceId: options.workspaceId,
      userId: options.userId,
      type: options.type,
      title: options.title,
      body: options.body,
      linkUrl: options.linkUrl ?? null,
    },
  });
}
