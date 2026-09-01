import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminAlertEmail, sendRenewalReminderEmail } from "@/lib/email";
import { runStaleDealsDigest } from "@/lib/stale-deals";

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Runs daily (see vercel.json). Sends exactly one "renews/ends soon" nudge
// per contract, once its renewalDate falls within the next 30 days — no
// per-workspace opt-in toggle, unlike the signature reminder: this is
// informational to the team, not client-facing, so there's no reason to
// gate it.
//
// Also runs the stale-deals digest (see src/lib/stale-deals.ts) in the same
// request — Vercel's Hobby plan caps a project at 2 cron jobs, and this
// project already has 2 without it (remind, renewals), so a 3rd daily job
// gets piggybacked here instead of registered separately in vercel.json.
// Each check is independent — a failure in one doesn't stop the other.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);

    const dueContracts = await prisma.contract.findMany({
      where: {
        status: "signed",
        renewalDate: { gte: now, lte: windowEnd },
        renewalReminderSentAt: null,
      },
      include: { deal: { include: { client: true, workspace: { include: { users: true } } } }, template: true },
    });

    let sent = 0;
    for (const contract of dueContracts) {
      const recipients = contract.deal.workspace.users.map((u) => u.email);
      if (recipients.length === 0 || !contract.renewalDate) continue;
      try {
        await sendRenewalReminderEmail({
          to: recipients,
          clientName: contract.deal.client.name,
          templateName: contract.template?.name ?? "contract",
          renewalDate: contract.renewalDate,
          autoRenews: contract.autoRenews,
          renewalNote: contract.renewalNote,
          dealUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/deals/${contract.dealId}/contract`,
        });
        await prisma.contract.update({ where: { id: contract.id }, data: { renewalReminderSentAt: new Date() } });
        sent++;
      } catch (err) {
        console.error(`Failed to send renewal reminder for contract ${contract.id}`, err);
      }
    }

    let staleResult = { checked: 0, sent: 0 };
    try {
      staleResult = await runStaleDealsDigest();
    } catch (err) {
      console.error("Stale-deals digest (piggybacked on renewals cron) crashed", err);
      try {
        await sendAdminAlertEmail({
          subject: "Stale-deals digest crashed",
          details: err instanceof Error ? (err.stack ?? err.message) : String(err),
        });
      } catch (alertErr) {
        console.error("Failed to send admin alert email", alertErr);
      }
    }

    return NextResponse.json({ renewals: { checked: dueContracts.length, sent }, staleDeals: staleResult });
  } catch (err) {
    console.error("Renewal reminder cron crashed", err);
    try {
      await sendAdminAlertEmail({
        subject: "Renewal reminder cron crashed",
        details: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
    } catch (alertErr) {
      console.error("Failed to send admin alert email", alertErr);
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
