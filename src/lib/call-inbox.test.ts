import { describe, expect, it, vi } from "vitest";

const { phoneCall, cold, telnyx } = vi.hoisted(() => ({
  phoneCall: { findUnique: vi.fn(), update: vi.fn() },
  cold: vi.fn(),
  telnyx: { recordingDownload: vi.fn(), deleteRecording: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { phoneCall } }));
vi.mock("@/lib/error-report", () => ({ reportError: async () => {} }));
vi.mock("@/lib/crm-call-sync", () => ({ pushCallToCrm: async () => {} }));
vi.mock("@/lib/sales-call", () => ({ applySalesCall: async () => {} }));
vi.mock("@/lib/cold-call", () => ({ applyColdCall: cold }));
vi.mock("@/lib/telnyx", () => telnyx);

import { callCostUsd, runCallProcessing, skipReason, speakerCount } from "./call-inbox";

const twoVoices = "Speaker 1: Hi, is this Dana?\nSpeaker 2: Speaking, who's this?\nSpeaker 1: It's Sam from SealMe.";

describe("Calls inbox", () => {
  it("counts the people talking, whatever the labels look like", () => {
    expect(speakerCount(twoVoices)).toBe(2);
    expect(speakerCount("Client: Hello?\nYou: Hi, it's Sam.")).toBe(2);
    expect(speakerCount("Speaker 1: Hi, you've reached Dana. Leave a message.")).toBe(1);
    expect(speakerCount("just words without any labels")).toBe(0);
  });

  it("sets aside short calls and one-voice calls before any model call", () => {
    expect(skipReason({ durationSec: 12, transcript: twoVoices })).toBe("too_short");
    expect(skipReason({ durationSec: 45, transcript: "Speaker 1: Hi, you've reached Dana. Leave a message after the tone." })).toBe("one_speaker");
    // A long call heard as one voice is a failed speaker split, not voicemail.
    expect(skipReason({ durationSec: 103, transcript: "Speaker 1: Hi, is this Gordan? Mhmm. Great, do you have a minute?" })).toBeNull();
    expect(skipReason({ durationSec: 95, transcript: twoVoices })).toBeNull();
    // Unknown length and unlabeled text: nothing to go on, so it's processed.
    expect(skipReason({ durationSec: null, transcript: "no labels here" })).toBeNull();
  });

  it("prices a call from minutes transcribed and tokens used", () => {
    // 3 minutes at $0.0043 plus 2,000 in / 400 out at $1 / $5 per million.
    expect(callCostUsd({ sttSeconds: 180, aiInputTokens: 2000, aiOutputTokens: 400 })).toBeCloseTo(0.0129 + 0.002 + 0.002, 6);
    expect(callCostUsd({ sttSeconds: null, aiInputTokens: null, aiOutputTokens: null })).toBe(0);
  });

  it("writes out a phone recording only when it's processed, then drops the audio", async () => {
    phoneCall.findUnique.mockResolvedValue({ id: "call1", status: "processing", mode: "cold", workspaceId: "w1", userId: "u1", lead: { id: "l1" }, transcript: null, telnyxRecordingId: "rec1", durationSec: 95 });
    telnyx.recordingDownload.mockResolvedValue({ url: "https://telnyx.example/rec1.mp3", seconds: 95 });
    telnyx.deleteRecording.mockResolvedValue(undefined);
    const deepgram = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ metadata: { duration: 95 }, results: { utterances: [{ speaker: 0, transcript: "Hi, is this Dana?" }, { speaker: 1, transcript: "Speaking." }] } })),
    );
    vi.stubGlobal("fetch", deepgram);

    await runCallProcessing("call1", "America/Chicago");

    expect(JSON.parse(deepgram.mock.calls[0][1].body)).toEqual({ url: "https://telnyx.example/rec1.mp3" });
    expect(phoneCall.update).toHaveBeenCalledWith({
      where: { id: "call1" },
      data: { transcript: "Speaker 1: Hi, is this Dana?\nSpeaker 2: Speaking.", sttSeconds: 95, durationSec: 95, telnyxRecordingId: null },
    });
    expect(telnyx.deleteRecording).toHaveBeenCalledWith("rec1");
    expect(cold.mock.calls[0][0]).toMatchObject({ phoneCallId: "call1", transcript: "Speaker 1: Hi, is this Dana?\nSpeaker 2: Speaking." });
    vi.unstubAllGlobals();
  });

  it("keeps the recording for a day when nothing was heard", async () => {
    phoneCall.findUnique.mockResolvedValue({ id: "call2", status: "processing", mode: "cold", workspaceId: "w1", userId: "u1", lead: { id: "l1" }, transcript: null, telnyxRecordingId: "rec2", durationSec: 62 });
    phoneCall.update.mockClear();
    telnyx.deleteRecording.mockClear();
    telnyx.recordingDownload.mockResolvedValue({ url: "https://telnyx.example/rec2.mp3", seconds: 62 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ metadata: { duration: 62 }, results: { utterances: [] } }))));

    await runCallProcessing("call2", "America/Chicago");

    expect(phoneCall.update.mock.calls[0][0].data).toMatchObject({ transcript: "", telnyxRecordingId: "rec2" });
    expect(phoneCall.update.mock.calls[1][0].data).toMatchObject({ status: "skipped", extracted: { skipped: "no_speech" } });
    expect(telnyx.deleteRecording).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
