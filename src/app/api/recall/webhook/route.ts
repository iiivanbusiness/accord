import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchBotTranscript, verifyRecallWebhook } from "@/lib/recall";
import { extractDealFromTranscript, buildDealFieldRows } from "@/lib/extract-deal";
import { extractPlaceholderKeys } from "@/lib/contract";

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
  const deal = await prisma.deal.findUnique({ where: { recallBotId: botId }, include: { client: true, template: true } });
  if (!deal || !deal.template) return NextResponse.json({ ok: true });

  try {
    const transcript = await fetchBotTranscript(botId);
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    const extracted = await extractDealFromTranscript(transcript, placeholderKeys);
    const { fieldRows, hasMissing, service, fee } = buildDealFieldRows(extracted, placeholderKeys);

    await prisma.client.update({
      where: { id: deal.clientId },
      data: {
        company: extracted.company ?? deal.client.company,
        email: extracted.email ?? deal.client.email,
      },
    });

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        service,
        feeDisplay: fee,
        status: hasMissing ? "missing_info" : "ready",
        fields: { create: fieldRows },
      },
    });
  } catch (err) {
    console.error(`Recall webhook: failed to process bot ${botId}`, err);
    await prisma.deal.update({ where: { id: deal.id }, data: { status: "missing_info" } });
  }

  return NextResponse.json({ ok: true });
}
