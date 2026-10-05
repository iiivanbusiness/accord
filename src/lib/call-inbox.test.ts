import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/error-report", () => ({ reportError: async () => {} }));
vi.mock("@/lib/crm-call-sync", () => ({ pushCallToCrm: async () => {} }));

import { callCostUsd, skipReason, speakerCount } from "./call-inbox";

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
    expect(skipReason({ durationSec: 95, transcript: "Speaker 1: Hi, you've reached Dana. Leave a message after the tone." })).toBe("one_speaker");
    expect(skipReason({ durationSec: 95, transcript: twoVoices })).toBeNull();
    // Unknown length and unlabeled text: nothing to go on, so it's processed.
    expect(skipReason({ durationSec: null, transcript: "no labels here" })).toBeNull();
  });

  it("prices a call from minutes transcribed and tokens used", () => {
    // 3 minutes at $0.0043 plus 2,000 in / 400 out at $1 / $5 per million.
    expect(callCostUsd({ sttSeconds: 180, aiInputTokens: 2000, aiOutputTokens: 400 })).toBeCloseTo(0.0129 + 0.002 + 0.002, 6);
    expect(callCostUsd({ sttSeconds: null, aiInputTokens: null, aiOutputTokens: null })).toBe(0);
  });
});
