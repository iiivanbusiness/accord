"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { sendReminderEmail } from "@/lib/email";
import { requestOrSendContract } from "@/lib/approval";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";

// An explicit manual nudge, not the automated 3-day cron — bypasses that
// cron's cutoff and its per-workspace autoRemind opt-in (someone actively
// chose to remind these clients right now), but still sets reminderSentAt
// so the cron doesn't also send a duplicate later.
export async function bulkRemind(dealIds: string[]): Promise<{ sent: number; skipped: number }> {
  const workspaceId = await requireWorkspaceId();
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds }, workspaceId },
    include: { client: true, workspace: true, contract: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const deal of deals) {
    if (!deal.contract || deal.contract.status !== "sent" || !deal.client.email) {
      skipped++;
      continue;
    }
    try {
      const verifiedSenderEmail = deal.workspace.senderDomainStatus === "verified" ? deal.workspace.senderEmail : null;
      await sendReminderEmail({
        to: deal.client.email,
        clientName: deal.client.name,
        workspaceName: deal.workspace.name,
        signLink: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign/${deal.contract.id}`,
        verifiedSenderEmail,
      });
      await prisma.contract.update({ where: { id: deal.contract.id }, data: { reminderSentAt: new Date() } });
      sent++;
    } catch (err) {
      console.error(`Bulk remind failed for deal ${deal.id}`, err);
      skipped++;
    }
  }

  const session = await auth();
  await logAudit({ workspaceId, actorEmail: session?.user?.email, action: "deals.bulk_reminded", metadata: { count: sent } });

  revalidatePath("/deals");
  return { sent, skipped };
}

// Sends every selected draft contract with the same default subject/message
// the individual Send page would pre-fill — only for deals that already
// have a reviewed contract sitting in draft with somewhere to send it.
export async function bulkSend(dealIds: string[]): Promise<{ sent: number; skipped: number }> {
  const workspaceId = await requireWorkspaceId();
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds }, workspaceId },
    include: { client: true, template: true, contract: true },
  });

  const session = await auth();
  let sent = 0;
  let skipped = 0;
  for (const deal of deals) {
    if (!deal.contract || deal.contract.status !== "draft" || !deal.client.email || !deal.template) {
      skipped++;
      continue;
    }
    try {
      const subject = `${deal.template.name} from ${workspace.name}`;
      const message = `Hi ${deal.client.name.split(" ")[0]},\n\nThanks again for the call — here's the ${deal.template.name.toLowerCase()} we discussed. Take a look and sign whenever you're ready.\n\nLet me know if anything needs adjusting.`;
      await requestOrSendContract(deal.id, { to: deal.client.email, subject, message }, session?.user?.email);
      sent++;
    } catch (err) {
      console.error(`Bulk send failed for deal ${deal.id}`, err);
      skipped++;
    }
  }

  revalidatePath("/deals");
  return { sent, skipped };
}
