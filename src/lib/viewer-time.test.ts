import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { dayInZone, startOfDayInZone } from "./viewer-time";

describe("viewer time", () => {
  it("knows which calendar day it is in the viewer's zone", () => {
    const lateUtc = new Date("2026-10-04T23:30:00Z");
    expect(dayInZone(lateUtc, "UTC")).toBe("2026-10-04");
    expect(dayInZone(lateUtc, "Europe/Belgrade")).toBe("2026-10-05");
    expect(dayInZone(lateUtc, "America/Los_Angeles")).toBe("2026-10-04");
  });
  it("finds the start of the viewer's day", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(startOfDayInZone(now, "Europe/Belgrade").toISOString()).toBe("2026-10-03T22:00:00.000Z");
    expect(startOfDayInZone(now, "America/New_York").toISOString()).toBe("2026-10-04T04:00:00.000Z");
    expect(startOfDayInZone(now, "UTC").toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });
});
