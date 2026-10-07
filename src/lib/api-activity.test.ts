import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/webhook-events", () => ({}));
vi.mock("@/lib/task-notify", () => ({}));
vi.mock("@/lib/cold-call", () => ({ stageAfterOutcome: () => null }));

import { parseCallInput, parseMeetingInput, parseTaskPatch } from "./api-activity";

describe("parseCallInput", () => {
  it("takes an outcome on its own", () => {
    const r = parseCallInput({ outcome: "no_answer", externalId: 9912, durationSec: "41.6", toNumber: "+1 (202) 555-0161", startedAt: "2026-10-01T13:00:00Z" });
    expect("data" in r && r.data).toMatchObject({ outcome: "no_answer", externalId: "9912", durationSec: 42, toNumber: "+12025550161", kind: null });
    expect("data" in r && r.data.startedAt.toISOString()).toBe("2026-10-01T13:00:00.000Z");
  });

  it("takes a transcript or a recording link without an outcome", () => {
    expect("data" in parseCallInput({ transcript: "Rep: Hi\nSam: Hello" })).toBe(true);
    expect("data" in parseCallInput({ recordingUrl: "https://dialer.example.com/rec/1.mp3", kind: "sales" })).toBe(true);
  });

  it("explains what's wrong", () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{}, /outcome, or a transcript/],
      [{ outcome: "booked" }, /outcome/],
      [{ recordingUrl: "http://dialer.example.com/1.mp3" }, /https/],
      [{ outcome: "voicemail", startedAt: "yesterday" }, /startedAt/],
      [{ outcome: "voicemail", startedAt: "2099-01-01T00:00:00Z" }, /future/],
      [{ outcome: "voicemail", durationSec: -3 }, /durationSec/],
      [{ outcome: "voicemail", kind: "warm" }, /kind/],
    ];
    for (const [body, msg] of cases) {
      const r = parseCallInput(body);
      expect("error" in r && r.error, JSON.stringify(body)).toMatch(msg);
    }
  });
});

describe("parseMeetingInput", () => {
  it("needs a day, and checks time and zone", () => {
    expect(parseMeetingInput({ date: "2026-10-20", time: "14:30", timeZone: "America/Chicago", note: " Demo " })).toEqual({
      data: { date: "2026-10-20", time: "14:30", timeZone: "America/Chicago", note: "Demo", externalId: null },
    });
    expect("error" in parseMeetingInput({ time: "14:30" })).toBe(true);
    expect("error" in parseMeetingInput({ date: "2026-10-20", time: "2pm" })).toBe(true);
    expect("error" in parseMeetingInput({ date: "2026-10-20", timeZone: "Mars/Olympus" })).toBe(true);
  });
});

describe("parseTaskPatch", () => {
  it("only touches what was sent, and null clears time and note", () => {
    expect(parseTaskPatch({ time: null, note: null })).toEqual({ data: { dueTime: null, note: null } });
    const r = parseTaskPatch({ date: "2026-10-21", status: "skipped" });
    expect("data" in r && r.data.dueDate?.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect("data" in r && r.data.status).toBe("skipped");
    expect("error" in parseTaskPatch({ status: "cancelled" })).toBe(true);
  });
});
