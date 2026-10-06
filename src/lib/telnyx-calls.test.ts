import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, telnyx } = vi.hoisted(() => ({
  db: {
    user: { findFirst: vi.fn() },
    callIntent: { findFirst: vi.fn(), update: vi.fn() },
    phoneCall: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
  telnyx: { callAction: vi.fn(), deleteRecording: vi.fn(), findRecordingId: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/error-report", () => ({ reportError: async () => {} }));
vi.mock("@/lib/call-inbox", () => ({ MIN_PROCESS_SECONDS: 30 }));
vi.mock("@/lib/telnyx", async (original) => ({ ...(await original<typeof import("./telnyx")>()), ...telnyx }));

import { handleTelnyxEvent } from "./telnyx-calls";
import { decodeClientState, encodeClientState } from "./telnyx";

const event = (event_type: string, payload: Record<string, unknown>) => ({ data: { event_type, payload: { call_control_id: "v3:cc1", ...payload } } });
const incoming = () => event("call.initiated", { direction: "incoming", from: "+15125550100", to: "+15125559999" });
const rep = (policy = "skip") => ({ id: "u1", workspaceId: "w1", workspace: { allPartyStatePolicy: policy } });
const intentFor = (phone: string | null) => ({ id: "i1", mode: "cold", templateId: null, lead: { id: "l1", phone } });
const lastAction = () => telnyx.callAction.mock.calls.at(-1)!;
const stateOf = (body: Record<string, unknown>) => decodeClientState<Record<string, unknown>>(body.client_state as string);

describe("Calls to the SealMe number", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    telnyx.callAction.mockResolvedValue({ data: { result: "ok" } });
    db.phoneCall.create.mockResolvedValue({ id: "call1" });
    telnyx.deleteRecording.mockResolvedValue(undefined);
  });

  it("turns away a number no rep has saved", async () => {
    db.user.findFirst.mockResolvedValue(null);
    await handleTelnyxEvent(incoming());
    const [, action, body] = lastAction();
    expect(action).toBe("answer");
    expect(stateOf(body)).toEqual({ k: "bye", m: "unknown" });
    expect(body.record).toBeUndefined();
    expect(db.phoneCall.create).not.toHaveBeenCalled();
  });

  it("records a call to a one-party state from the moment SealMe answers", async () => {
    db.user.findFirst.mockResolvedValue(rep());
    db.callIntent.findFirst.mockResolvedValue(intentFor("+15125550123")); // Austin, TX
    telnyx.callAction.mockResolvedValue({ data: { result: "ok", recording_id: "rec1" } });
    await handleTelnyxEvent(incoming());

    expect(db.callIntent.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { usedAt: expect.any(Date) } });
    const created = db.phoneCall.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ leadId: "l1", mode: "cold", status: "recording", recorded: true, consentState: "TX", consentRule: "one_party", fromNumber: "+15125550100" });
    const [, action, body] = lastAction();
    expect(action).toBe("answer");
    expect(body).toMatchObject({ record: "record-from-answer", record_channels: "single", record_format: "mp3" });
    expect(stateOf(body)).toEqual({ k: "rec", c: "call1" });
    expect(db.phoneCall.update).toHaveBeenCalledWith({ where: { id: "call1" }, data: { telnyxRecordingId: "rec1" } });
  });

  it("doesn't record an all-party state when the workspace says skip", async () => {
    db.user.findFirst.mockResolvedValue(rep("skip"));
    db.callIntent.findFirst.mockResolvedValue(intentFor("+14155550123")); // San Francisco, CA
    await handleTelnyxEvent(incoming());
    expect(db.phoneCall.create.mock.calls[0][0].data).toMatchObject({ status: "skipped", recorded: false, consentState: "CA", consentRule: "all_party", extracted: { skipped: "not_recorded" } });
    const [, , body] = lastAction();
    expect(body.record).toBeUndefined();
    expect(stateOf(body)).toEqual({ k: "bye", m: "off", c: "call1" });
  });

  it("never records without a lead, or a toll-free or foreign number", async () => {
    db.user.findFirst.mockResolvedValue(rep("announce"));
    for (const intent of [null, intentFor(null), intentFor("+18005550100"), intentFor("+447700900123")]) {
      db.callIntent.findFirst.mockResolvedValue(intent);
      await handleTelnyxEvent(incoming());
      expect(stateOf(lastAction()[2])?.k).toBe("bye");
    }
    expect(db.phoneCall.create.mock.calls.map((c) => c[0].data.consentRule)).toEqual(["no_number", "no_number", "toll_free", "non_us"]);
    // Without a Call tap, the rep is told to tap Call on a lead first.
    expect(telnyx.callAction.mock.calls.map((c) => stateOf(c[2])?.m)).toEqual(["nolead", "off", "off", "off"]);
  });

  it("plays the notice before recording an all-party state, when the workspace allows it", async () => {
    db.user.findFirst.mockResolvedValue(rep("announce"));
    db.callIntent.findFirst.mockResolvedValue(intentFor("+14155550123"));
    await handleTelnyxEvent(incoming());
    expect(db.phoneCall.create.mock.calls[0][0].data).toMatchObject({ status: "recording", recorded: false });
    const [, , answer] = lastAction();
    expect(answer.record).toBeUndefined();
    const notice = answer.client_state as string;

    await handleTelnyxEvent(event("call.answered", { client_state: notice }));
    expect(lastAction()[1]).toBe("speak");

    telnyx.callAction.mockClear();
    await handleTelnyxEvent(event("call.dtmf.received", { client_state: notice, digit: "2" }));
    expect(telnyx.callAction).not.toHaveBeenCalled();
    await handleTelnyxEvent(event("call.dtmf.received", { client_state: notice, digit: "1" }));
    const [, speak, spoken] = lastAction();
    expect(speak).toBe("speak");
    expect(spoken.payload).toBe("This call is being recorded.");

    await handleTelnyxEvent(event("call.speak.ended", { client_state: spoken.client_state }));
    const [, start, recordBody] = lastAction();
    expect(start).toBe("record_start");
    expect(stateOf(recordBody)).toEqual({ k: "rec", c: "call1" });
    expect(db.phoneCall.update).toHaveBeenCalledWith({ where: { id: "call1" }, data: { recorded: true } });
  });

  it("closes a call whose notice was never played", async () => {
    db.phoneCall.findUnique.mockResolvedValue({ id: "call1", status: "recording", recorded: false, endedAt: null });
    await handleTelnyxEvent(event("call.hangup", { client_state: encodeClientState({ k: "notice", c: "call1" }) }));
    expect(db.phoneCall.update.mock.calls[0][0].data).toMatchObject({ status: "skipped", extracted: { skipped: "not_recorded" } });
  });

  it("says why, then hangs up, when SealMe isn't recording", async () => {
    const bye = encodeClientState({ k: "bye", m: "unknown" });
    await handleTelnyxEvent(event("call.answered", { client_state: bye }));
    expect(lastAction()[1]).toBe("speak");
    expect(lastAction()[2].payload).toMatch(/isn't set up in SealMe/);
    await handleTelnyxEvent(event("call.speak.ended", { client_state: bye }));
    expect(lastAction()[1]).toBe("hangup");
  });

  it("puts a finished recording in the inbox, untranscribed", async () => {
    db.phoneCall.findUnique.mockResolvedValue({ id: "call1", status: "recording", recorded: true, telnyxRecordingId: null, endedAt: null, leadId: null });
    const result = await handleTelnyxEvent(
      event("call.recording.saved", {
        client_state: encodeClientState({ k: "rec", c: "call1" }),
        recording_id: "rec1",
        recording_started_at: "2026-10-06T10:00:00Z",
        recording_ended_at: "2026-10-06T10:03:12Z",
      }),
    );
    expect(db.phoneCall.update.mock.calls[0][0].data).toMatchObject({ status: "pending", durationSec: 192, telnyxRecordingId: "rec1" });
    expect(telnyx.deleteRecording).not.toHaveBeenCalled();
    // No lead to write it up for: it waits in the inbox.
    expect(result).toEqual({});
  });

  it("hands a call tied to a lead straight to processing", async () => {
    db.phoneCall.findUnique.mockResolvedValue({ id: "call1", status: "recording", recorded: true, telnyxRecordingId: "rec1", endedAt: null, leadId: "l1" });
    const result = await handleTelnyxEvent(
      event("call.recording.saved", {
        client_state: encodeClientState({ k: "rec", c: "call1" }),
        recording_started_at: "2026-10-06T10:00:00Z",
        recording_ended_at: "2026-10-06T10:01:43Z",
      }),
    );
    expect(result).toEqual({ processCallId: "call1" });
  });

  it("sets aside a call under 30 seconds and drops its recording", async () => {
    db.phoneCall.findUnique.mockResolvedValue({ id: "call1", status: "recording", recorded: true, telnyxRecordingId: "rec1", endedAt: null, leadId: "l1" });
    const result = await handleTelnyxEvent(
      event("call.recording.saved", {
        client_state: encodeClientState({ k: "rec", c: "call1" }),
        recording_started_at: "2026-10-06T10:00:00Z",
        recording_ended_at: "2026-10-06T10:00:12Z",
      }),
    );
    expect(result).toEqual({});
    expect(db.phoneCall.update.mock.calls[0][0].data).toMatchObject({ status: "skipped", durationSec: 12, telnyxRecordingId: null, extracted: { skipped: "too_short" } });
    expect(telnyx.deleteRecording).toHaveBeenCalledWith("rec1");
  });
});
