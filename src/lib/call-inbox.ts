import { prisma } from "@/lib/db";
import { applyColdCall } from "@/lib/cold-call";
import { INPUT_USD_PER_MTOK, OUTPUT_USD_PER_MTOK } from "@/lib/extract-cold-call";
import { reportError } from "@/lib/error-report";
import { pushCallToCrm } from "@/lib/crm-call-sync";

// Calls shorter than this aren't worth a model call: nobody picked up, or
// the line dropped.
export const MIN_PROCESS_SECONDS = 30;
// Calls nobody acts on are dropped after a day, so a transcript doesn't sit
// around unasked for (see the daily cron).
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
// Deepgram Nova-3, prerecorded, pay as you go. Checked against the Deepgram
// dashboard when call costs were first compared (Phase 3.4).
export const STT_USD_PER_MINUTE = 0.0043;

export const SKIP_LABEL: Record<string, string> = {
  too_short: "Under 30 seconds",
  one_speaker: "Only one voice (likely voicemail)",
};

// How many different people talk in a transcript. Diarized recordings
// label turns "Speaker 1:", the desktop recorder "Client:" / "You:".
// 0 when the transcript has no labels at all, which says nothing.
export function speakerCount(transcript: string): number {
  const speakers = new Set<string>();
  for (const line of transcript.split("\n")) {
    const label = line.match(/^([^:\n]{1,40}):\s/)?.[1]?.trim();
    if (label) speakers.add(label.toLowerCase());
  }
  return speakers.size;
}

// Why a call shouldn't go to the model, if it shouldn't.
export function skipReason(call: { durationSec: number | null; transcript: string | null }): "too_short" | "one_speaker" | null {
  if (call.durationSec !== null && call.durationSec < MIN_PROCESS_SECONDS) return "too_short";
  if (call.transcript && speakerCount(call.transcript) === 1) return "one_speaker";
  return null;
}

// What a call cost us: transcription by the minute plus the model's tokens.
export function callCostUsd(call: { sttSeconds: number | null; aiInputTokens: number | null; aiOutputTokens: number | null }): number {
  const stt = ((call.sttSeconds ?? 0) / 60) * STT_USD_PER_MINUTE;
  const ai = ((call.aiInputTokens ?? 0) * INPUT_USD_PER_MTOK + (call.aiOutputTokens ?? 0) * OUTPUT_USD_PER_MTOK) / 1_000_000;
  return stt + ai;
}

// Runs in the background after someone clicks Process: the call is already
// marked processing with its lead and kind. Short calls and one-voice calls
// are set aside without a model call; anything that throws is marked failed
// so it can be retried from the inbox. force runs the model even on a call
// that would be set aside ("Process anyway", when the speaker split was
// wrong).
export async function runCallProcessing(callId: string, timeZone: string, options: { force?: boolean } = {}): Promise<void> {
  const call = await prisma.phoneCall.findUnique({ where: { id: callId }, include: { lead: true } });
  if (!call || call.status !== "processing") return;
  try {
    const skip = options.force ? null : skipReason(call);
    if (skip) {
      await prisma.phoneCall.update({
        where: { id: callId },
        data: { status: "skipped", connected: false, extracted: { skipped: skip }, processedAt: new Date() },
      });
      return;
    }
    if (!call.lead || !call.userId || !call.transcript) throw new Error("This call has no lead, rep or transcript");
    if (call.mode !== "cold") throw new Error(`Calls of kind "${call.mode}" can't be processed yet`);
    await applyColdCall({
      workspaceId: call.workspaceId,
      userId: call.userId,
      lead: call.lead,
      transcript: call.transcript,
      timeZone,
      phoneCallId: call.id,
    });
  } catch (err) {
    await prisma.phoneCall.update({ where: { id: callId }, data: { status: "failed" } }).catch(() => {});
    await reportError(err, "Call processing", { callId, workspaceId: call.workspaceId });
    return;
  }
  // Outside the try: a CRM hiccup must never mark a processed call failed.
  await pushCallToCrm(callId);
}

// For the daily cron: calls left unprocessed for a day are dropped, and
// their transcripts with them.
export async function discardStaleCalls(now = new Date()): Promise<number> {
  const { count } = await prisma.phoneCall.updateMany({
    where: { status: { in: ["pending", "failed"] }, startedAt: { lt: new Date(now.getTime() - PENDING_TTL_MS) } },
    data: { status: "discarded", transcript: null, summary: null },
  });
  return count;
}
