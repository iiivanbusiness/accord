import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Runs daily (see vercel.json). Sends exactly one "still unsigned" nudge per
// contract, 3 days after it was sent, only for workspaces that opted in via
// the "Auto-remind clients after 3 days" setting.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - THREE_DAYS_MS);

  const dueContracts = await prisma.contract.findMany({
    where: {
      status: "sent",
      sentAt: { lte: cutoff },
      reminderSentAt: null,
      deal: { workspace: { autoRemind: true } },
    },
    include: { deal: { include: { client: true, workspace: true } } },
  });

  let sent = 0;
  for (const contract of dueContracts) {
    if (!contract.deal.client.email) continue;
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
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for contract ${contract.id}`, err);
    }
  }

  return NextResponse.json({ checked: dueContracts.length, sent });
}
