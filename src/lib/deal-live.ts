import { prisma } from "@/lib/db";
import { extractDealFromTranscript, buildDealFieldRows } from "@/lib/extract-deal";

// Runs an extraction pass against the given transcript and writes the result onto
// an existing deal — upserting fields (never overwriting a human-confirmed or
// user-edited value) and flipping deal status the moment nothing is missing,
// even mid-call. Used by both the live realtime webhook and the final post-call pass.
export async function applyExtractionToDeal(
  dealId: string,
  transcript: string,
  placeholderKeys: string[],
  callId?: string
): Promise<{ hasMissing: boolean }> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Deal not found");
  if (deal.status === "sent" || deal.status === "signed") return { hasMissing: false };

  const extracted = await extractDealFromTranscript(transcript, placeholderKeys, deal.lastExtractedTranscript);
  const { fieldRows, service, fee } = buildDealFieldRows(extracted, placeholderKeys);

  const existing = await prisma.dealField.findMany({ where: { dealId } });
  const existingByKey = new Map(existing.map((f) => [f.fieldKey, f]));
  const locked = (key: string) => {
    const current = existingByKey.get(key);
    return current?.status === "confirmed" || current?.status === "user_edited";
  };

  for (const row of fieldRows) {
    if (locked(row.fieldKey)) continue;

    // A real change — not "missing found a value" for the first time, that's
    // not a negotiation moving, just extraction catching up.
    const previousValue = existingByKey.get(row.fieldKey)?.value;
    if (previousValue && row.value && previousValue !== row.value) {
      await prisma.dealFieldChange.create({
        data: {
          dealId,
          fieldKey: row.fieldKey,
          oldValue: previousValue,
          newValue: row.value,
          changedBy: "extraction",
          callId,
          sourceQuote: row.sourceQuote,
        },
      });
    }

    await prisma.dealField.upsert({
      where: { dealId_fieldKey: { dealId, fieldKey: row.fieldKey } },
      create: {
        dealId,
        groupLabel: row.groupLabel,
        label: row.label,
        fieldKey: row.fieldKey,
        value: row.value,
        status: row.status,
        confidence: row.confidence,
        sourceQuote: row.sourceQuote,
        orderIndex: row.orderIndex,
      },
      update: {
        value: row.value,
        status: row.status,
        confidence: row.confidence,
        sourceQuote: row.sourceQuote,
      },
    });
  }

  const finalFields = await prisma.dealField.findMany({ where: { dealId } });
  const hasMissing = finalFields.some((f) => f.status === "missing");

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      service: locked("service") ? deal.service : service || deal.service,
      feeDisplay: locked("fee") ? deal.feeDisplay : fee || deal.feeDisplay,
      status: hasMissing ? "missing_info" : "ready",
      summary: extracted.summary ?? deal.summary,
      lastExtractedAt: new Date(),
      // Baseline for next pass's cache split — becomes the "stable" block
      // extractDealFromTranscript will look for verbatim next time.
      lastExtractedTranscript: transcript,
    },
  });

  if (extracted.company || extracted.email) {
    await prisma.client.update({
      where: { id: deal.clientId },
      data: {
        ...(extracted.company ? { company: extracted.company } : {}),
        ...(extracted.email ? { email: extracted.email } : {}),
      },
    });
  }

  return { hasMissing };
}
