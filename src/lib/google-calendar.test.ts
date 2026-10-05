import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildAuthorizeUrl, hasCalendarScope } from "./google-calendar";

describe("Google Calendar scopes", () => {
  it("asks only for read access to events, plus the email address", () => {
    const scope = new URL(buildAuthorizeUrl("state")).searchParams.get("scope");
    expect(scope?.split(" ").sort()).toEqual([
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
  });

  it("notices when calendar access was left unticked on Google's screen", () => {
    expect(hasCalendarScope("https://www.googleapis.com/auth/userinfo.email openid")).toBe(false);
    expect(hasCalendarScope(undefined)).toBe(false);
    expect(
      hasCalendarScope("openid https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email")
    ).toBe(true);
  });
});
