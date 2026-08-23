import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRecallWebhook, parseRealtimeTranscriptEvent } from "@/lib/recall";
import { applyExtractionToDeal } from "@/lib/deal-live";
import { extractPlaceholderKeys } from "@/lib/contract";

// Re-running full extraction on every single utterance would be wasteful (a sales
// call can produce dozens of these per minute) — throttle to one pass per window.
const EXTRACTION_THROTTLE_MS = 15000;

export async function POST(req: Request) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: unknown;
  try {
    event = await verifyRecallWebhook(payload, headers);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const parsed = parseRealtimeTranscriptEvent(event);
  if (!parsed) return NextResponse.json({ ok: true });

  const deal = await prisma.deal.findUnique({ where: { recallBotId: parsed.botId }, include: { template: true } });
  if (!deal || !deal.template) return NextResponse.json({ ok: true });

  // Recall delivers utterances sequentially, but an atomic append still protects
  // against overlapping deliveries or retries — a read-modify-write here could
  // silently drop an utterance if two requests overlapped.
  const line = `\n${parsed.speaker}: ${parsed.text}`;
  await prisma.$executeRaw`UPDATE "Deal" SET "liveTranscript" = COALESCE("liveTranscript", '') || ${line} WHERE id = ${deal.id}`;

  const dueForExtraction = !deal.lastExtractedAt || Date.now() - deal.lastExtractedAt.getTime() >= EXTRACTION_THROTTLE_MS;
  if (dueForExtraction) {
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    // Claim the throttle window synchronously so a burst of utterances arriving
    // while the LLM call below is still in flight doesn't trigger a duplicate pass.
    await prisma.deal.update({ where: { id: deal.id }, data: { lastExtractedAt: new Date() } });

    // The LLM call and DB writes can take a few seconds — do that after responding
    // so we never delay the 2xx Recall is waiting on before sending the next utterance.
    after(async () => {
      try {
        const fresh = await prisma.deal.findUnique({ where: { id: deal.id } });
        if (!fresh) return;
        await applyExtractionToDeal(deal.id, fresh.liveTranscript ?? "", placeholderKeys);
      } catch (err) {
        console.error("Recall realtime extraction failed", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
