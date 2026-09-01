import { prisma } from "@/lib/db";
import { sendStaleDealsEmail } from "@/lib/email";

const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// A deal sitting in "ready" or "missing_info" — someone needs to review it
// or fill something in, and nothing else nudges that — with no activity
// for a week gets bundled into one digest email per workspace, not one
// email per deal. Re-fires every 7 days for as long as it stays genuinely
// untouched (staleReminderSentAt only counts if it's *after* the deal's
// last real update), so a deal forgotten for a month doesn't just quietly
// stop being mentioned after the first nudge.
export async function runStaleDealsDigest(): Promise<{ checked: number; sent: number }> {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * DAY_MS);

  const staleDeals = await prisma.deal.findMany({
    where: {
      status: { in: ["ready", "missing_info"] },
      updatedAt: { lte: cutoff },
      OR: [{ staleReminderSentAt: null }, { staleReminderSentAt: { lte: cutoff } }],
    },
    include: { client: true, workspace: { include: { users: true } } },
  });

  const byWorkspace = new Map<string, typeof staleDeals>();
  for (const deal of staleDeals) {
    if (!byWorkspace.has(deal.workspaceId)) byWorkspace.set(deal.workspaceId, []);
    byWorkspace.get(deal.workspaceId)!.push(deal);
  }

  let sent = 0;
  for (const [, workspaceDeals] of byWorkspace) {
    const recipients = workspaceDeals[0].workspace.users.map((u) => u.email);
    if (recipients.length === 0) continue;
    try {
      await sendStaleDealsEmail({
        to: recipients,
        deals: workspaceDeals.map((d) => ({
          clientName: d.client.name,
          service: d.service,
          daysSinceUpdate: Math.floor((Date.now() - d.updatedAt.getTime()) / DAY_MS),
          dealUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/deals/${d.id}`,
        })),
      });
      await prisma.deal.updateMany({
        where: { id: { in: workspaceDeals.map((d) => d.id) } },
        data: { staleReminderSentAt: new Date() },
      });
      sent += workspaceDeals.length;
    } catch (err) {
      console.error(`Failed to send stale-deals digest for workspace ${workspaceDeals[0].workspaceId}`, err);
    }
  }

  return { checked: staleDeals.length, sent };
}
