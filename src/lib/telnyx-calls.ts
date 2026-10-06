import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { consentFor, recordingDecision } from "@/lib/call-consent";
import { MIN_PROCESS_SECONDS } from "@/lib/call-inbox";
import { callAction, decodeClientState, deleteRecording, encodeClientState, findRecordingId, type TelnyxEvent } from "@/lib/telnyx";
import { reportError } from "@/lib/error-report";

// What a call is doing, carried on the call itself (client_state):
//   rec     recording since SealMe answered
//   notice  waiting for the rep to press 1 for the recording notice
//   noticing  playing the notice; recording starts when it ends
//   bye     saying why SealMe isn't on this call, then hanging up
type CallState = { k: "rec" | "notice" | "noticing" | "bye"; c?: string; m?: ByeReason };
type ByeReason = "unknown" | "off";

const VOICE = { voice: "AWS.Polly.Joanna-Neural", language: "en-US" };
const SAY: Record<ByeReason | "notice_prompt" | "notice", string> = {
  unknown: "This is SealMe. This phone number isn't set up in SealMe yet. Add it in SealMe under Settings, then call again. Goodbye.",
  off: "This is SealMe. Recording is off for this call. Hang up and call your client directly.",
  notice_prompt: "SealMe is on the line. Once your client is on the call too, press 1 to play the recording notice. Nothing is recorded before that.",
  notice: "This call is being recorded.",
};
// A safety cap; a sales call longer than this is unheard of.
const MAX_RECORDING_SECONDS = 4 * 60 * 60;

const recordOptions = (callId: string) => ({ record_format: "mp3", record_channels: "single", record_max_length: MAX_RECORDING_SECONDS, command_id: `record-${callId}` });

// One verified event from the SealMe number. Throws only on our own
// errors; the route reports them and still answers Telnyx, so a retry
// doesn't send the same command twice.
export async function handleTelnyxEvent(event: TelnyxEvent): Promise<void> {
  const type = event.data?.event_type;
  const p = event.data?.payload;
  const id = p?.call_control_id;
  if (!type || !p || !id) return;
  const state = decodeClientState<CallState>(p.client_state);

  switch (type) {
    case "call.initiated":
      if (p.direction === "incoming") await answerIncoming(id, p.from ?? null);
      return;
    case "call.answered":
      if (state?.k === "bye" && state.m) await callAction(id, "speak", { ...VOICE, payload: SAY[state.m], command_id: `bye-${id}` });
      if (state?.k === "notice") await callAction(id, "speak", { ...VOICE, payload: SAY.notice_prompt, command_id: `prompt-${id}` });
      return;
    case "call.dtmf.received":
      if (state?.k === "notice" && p.digit === "1" && state.c) {
        await callAction(id, "speak", { ...VOICE, payload: SAY.notice, client_state: encodeClientState({ k: "noticing", c: state.c }), command_id: `notice-${id}` });
      }
      return;
    case "call.speak.ended":
      if (state?.k === "bye") await callAction(id, "hangup", { command_id: `hangup-${id}` });
      if (state?.k === "noticing" && state.c) await startRecordingAfterNotice(id, state.c);
      return;
    case "call.hangup":
      await callEnded(id, state);
      return;
    case "call.recording.saved":
      await recordingSaved(id, state, p);
      return;
  }
}

// Someone dialed the SealMe number. A rep is known by the number they call
// from; the lead comes from the Call button they tapped (a CallIntent),
// and the lead's area code decides whether SealMe may record.
async function answerIncoming(callControlId: string, rawFrom: string | null): Promise<void> {
  const from = normalizePhone(rawFrom);
  const rep = from
    ? await prisma.user.findFirst({
        where: { phone: from, deactivatedAt: null, workspace: { prospectingEnabled: true } },
        select: { id: true, workspaceId: true, workspace: { select: { allPartyStatePolicy: true } } },
      })
    : null;
  if (!rep) {
    await callAction(callControlId, "answer", { client_state: encodeClientState({ k: "bye", m: "unknown" }), command_id: `answer-${callControlId}` });
    return;
  }

  const now = new Date();
  const intent = await prisma.callIntent.findFirst({
    where: { userId: rep.id, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    include: { lead: { select: { id: true, phone: true } } },
  });
  if (intent) await prisma.callIntent.update({ where: { id: intent.id }, data: { usedAt: now } });

  const consent = consentFor(intent?.lead?.phone ?? null);
  const { record, announce } = recordingDecision(consent.rule, rep.workspace.allPartyStatePolicy);

  let callId: string;
  try {
    const call = await prisma.phoneCall.create({
      data: {
        workspaceId: rep.workspaceId,
        userId: rep.id,
        leadId: intent?.lead?.id ?? null,
        mode: intent?.mode ?? "unknown",
        templateId: intent?.templateId ?? null,
        source: "phone",
        status: record ? "recording" : "skipped",
        ...(record ? {} : { extracted: { skipped: "not_recorded" }, processedAt: now }),
        fromNumber: from,
        toNumber: intent?.lead?.phone ?? null,
        consentState: consent.state,
        consentRule: consent.rule,
        // With the notice, recording starts only once it has played.
        recorded: record && !announce,
        telnyxCallControlId: callControlId,
        startedAt: now,
      },
    });
    callId = call.id;
  } catch (err) {
    // Telnyx sent this event twice; the first one already answered.
    if ((err as { code?: string }).code === "P2002") return;
    throw err;
  }

  if (!record) {
    await callAction(callControlId, "answer", { client_state: encodeClientState({ k: "bye", m: "off", c: callId }), command_id: `answer-${callControlId}` });
    return;
  }
  if (announce) {
    await callAction(callControlId, "answer", { client_state: encodeClientState({ k: "notice", c: callId }), command_id: `answer-${callControlId}` });
    return;
  }
  const answered = await callAction(callControlId, "answer", {
    client_state: encodeClientState({ k: "rec", c: callId }),
    record: "record-from-answer",
    ...recordOptions(callId),
    command_id: `answer-${callControlId}`,
  });
  if (answered.data?.recording_id) await prisma.phoneCall.update({ where: { id: callId }, data: { telnyxRecordingId: answered.data.recording_id } });
}

// The notice has played to everyone on the merged call; only now does
// SealMe start recording.
async function startRecordingAfterNotice(callControlId: string, callId: string): Promise<void> {
  await callAction(callControlId, "record_start", { ...recordOptions(callId), client_state: encodeClientState({ k: "rec", c: callId }) });
  await prisma.phoneCall.update({ where: { id: callId }, data: { recorded: true } });
}

async function findCall(callControlId: string, state: CallState | null) {
  if (state?.c) return prisma.phoneCall.findUnique({ where: { id: state.c } });
  return prisma.phoneCall.findUnique({ where: { telnyxCallControlId: callControlId } });
}

// The rep hung up. A recorded call waits for its recording; one where
// recording never started (the notice wasn't played) is closed here.
async function callEnded(callControlId: string, state: CallState | null): Promise<void> {
  const call = await findCall(callControlId, state);
  if (!call) return;
  const now = new Date();
  if (call.status === "recording" && !call.recorded) {
    await prisma.phoneCall.update({ where: { id: call.id }, data: { status: "skipped", extracted: { skipped: "not_recorded" }, endedAt: now, processedAt: now } });
    return;
  }
  if (!call.endedAt) await prisma.phoneCall.update({ where: { id: call.id }, data: { endedAt: now } });
}

// The recording is ready: the call lands in the inbox, still untranscribed
// (transcription is paid for only when someone clicks Process). A call too
// short to be worth anything is set aside and its recording dropped.
async function recordingSaved(callControlId: string, state: CallState | null, p: NonNullable<NonNullable<TelnyxEvent["data"]>["payload"]>): Promise<void> {
  const call = await findCall(callControlId, state);
  if (!call || call.status !== "recording") return;
  const recordingId = p.recording_id ?? call.telnyxRecordingId ?? (await findRecordingId(callControlId));
  const started = p.recording_started_at ? Date.parse(p.recording_started_at) : NaN;
  const ended = p.recording_ended_at ? Date.parse(p.recording_ended_at) : NaN;
  const seconds = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - started) / 1000)) : null;
  const tooShort = seconds !== null && seconds < MIN_PROCESS_SECONDS;

  await prisma.phoneCall.update({
    where: { id: call.id },
    data: {
      telnyxRecordingId: tooShort ? null : recordingId,
      durationSec: seconds,
      endedAt: call.endedAt ?? new Date(),
      status: tooShort ? "skipped" : "pending",
      ...(tooShort ? { extracted: { skipped: "too_short" }, processedAt: new Date() } : {}),
    },
  });
  if (tooShort && recordingId) await deleteRecording(recordingId).catch((err) => reportError(err, "Deleting a short call's recording", { callId: call.id }));
}
