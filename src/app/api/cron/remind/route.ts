import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminAlertEmail, sendReminderEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

// Runs daily (see vercel.json). Two independent sweeps over "sent"
// contracts, sharing this one cron slot (Hobby plan caps at 2 total —
// see stale-deals.ts for the other consolidation): the "still unsigned"
// nudge, and marking contracts past their configured expiry.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let reminded = 0;
  let expired = 0;

  try {
    // Reminder cadence is per-workspace (reminderIntervalDays) since it
    // moved off a hardcoded 3 days — can't push that into the query
    // itself, so pull every still-eligible candidate and check each one.
    const reminderCandidates = await prisma.contract.findMany({
      where: {
        status: "sent",
        reminderSentAt: null,
        deal: { workspace: { autoRemind: true } },
      },
      include: { deal: { include: { client: true, workspace: true } } },
    });

    for (const contract of reminderCandidates) {
      if (!contract.sentAt || !contract.deal.client.email) continue;
      const dueAt = contract.sentAt.getTime() + contract.deal.workspace.reminderIntervalDays * 24 * 60 * 60 * 1000;
      if (dueAt > Date.now()) continue;

      try {
        const verifiedSenderEmail = contract.deal.workspace.senderDomainStatus === "verified" ? contract.deal.workspace.senderEmail : null;
        await sendReminderEmail({
          to: contract.deal.client.email,
          clientName: contract.deal.client.name,
          workspaceName: contract.deal.workspace.name,
          signLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign/${contract.id}`,
          verifiedSenderEmail,
        });
        await prisma.contract.update({ where: { id: contract.id }, data: { reminderSentAt: new Date() } });
        reminded++;
      } catch (err) {
        console.error(`Failed to send reminder for contract ${contract.id}`, err);
      }
    }
  } catch (err) {
    console.error("Reminder sweep crashed", err);
    try {
      await sendAdminAlertEmail({ subject: "Reminder cron crashed", details: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    } catch (alertErr) {
      console.error("Failed to send admin alert email", alertErr);
    }
  }

  try {
    const expiredResult = await prisma.contract.findMany({
      where: { status: "sent", expiresAt: { lte: new Date() } },
      include: { deal: { select: { id: true, workspaceId: true } } },
    });
    for (const contract of expiredResult) {
      await prisma.contract.update({ where: { id: contract.id }, data: { status: "expired" } });
      await logAudit({ workspaceId: contract.deal.workspaceId, action: "contract.expired", targetType: "Contract", targetId: contract.id });
      expired++;
    }
  } catch (err) {
    console.error("Expiry sweep crashed", err);
  }

  return NextResponse.json({ reminded, expired });
}
