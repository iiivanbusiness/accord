import { describe, expect, it } from "vitest";
import { transcriptFromChannels } from "./recording-transcript";

describe("Two-channel phone recordings", () => {
  it("labels each turn by channel, in the order people spoke", () => {
    const data = {
      metadata: { duration: 41.6 },
      results: {
        utterances: [
          { channel: 0, start: 3.1, transcript: "Speaking." },
          { channel: 1, start: 0.4, transcript: "Hi, is this Dana?" },
          { channel: 1, start: 4.2, transcript: "It's Ivan from SealMe." },
          { channel: 1, start: 6.0, transcript: "Do you have a minute?" },
          { channel: 0, start: 8.5, transcript: "" },
        ],
      },
    };
    expect(transcriptFromChannels(data, ["Client", "Rep"])).toEqual({
      transcript: "Rep: Hi, is this Dana?\nClient: Speaking.\nRep: It's Ivan from SealMe. Do you have a minute?",
      seconds: 42,
      turns: 3,
    });
  });
});
