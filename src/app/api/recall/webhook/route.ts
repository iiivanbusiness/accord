import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchBotTranscript, verifyRecallWebhook } from "@/lib/recall";
import { applyExtractionToDeal } from "@/lib/deal-live";
import { extractPlaceholderKeys } from "@/lib/contract";
import { autoGenerateAndSendContract } from "@/lib/auto-send";

type RecallWebhookPayload = {
  event: string;
  data: { bot: { id: string } };
};

export async function POST(req: Request) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: RecallWebhookPayload;
  try {
    event = (await verifyRecallWebhook(payload, headers)) as RecallWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  if (event.event !== "bot.done") {
    return NextResponse.json({ ok: true });
  }

  const botId = event.data.bot.id;
  const deal = await prisma.deal.findUnique({ where: { recallBotId: botId }, include: { template: true, workspace: true } });
  if (!deal || !deal.template) return NextResponse.json({ ok: true });

  try {
    // The full post-call recording transcribes more accurately than the live stream —
    // this is the final, authoritative pass, reconciling anything the live pass missed.
    const transcript = await fetchBotTranscript(botId);
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    const { hasMissing } = await applyExtractionToDeal(deal.id, transcript, placeholderKeys);

    // "Require manual approval before sending" off means nobody has to review an
    // unattended (scheduled/live) call's contract before it goes out — only safe
    // to do this once every required field actually has a value.
    if (!hasMissing && !deal.workspace.requireApproval) {
      await autoGenerateAndSendContract(deal.id);
    }
  } catch (err) {
    console.error(`Recall webhook: failed to process bot ${botId}`, err);
    if (deal.status !== "sent" && deal.status !== "signed") {
      await prisma.deal.update({ where: { id: deal.id }, data: { status: "extraction_failed" } });
    }
  }

  return NextResponse.json({ ok: true });
}
