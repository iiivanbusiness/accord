import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/webhooks", () => ({ dispatchWebhookEvents: vi.fn(), leadWebhookData: vi.fn() }));

import { leadChanges } from "./webhook-events";

describe("leadChanges", () => {
  const before = { stage: "contacted", ownerId: "u1", email: "sam@acme.test", nextStepAt: new Date("2026-10-20T00:00:00Z"), summary: "old", title: null };

  it("lists only fields whose value really changes, by their API name", () => {
    const c = leadChanges("l1", before, { stage: "meeting", ownerId: "u2", email: "sam@acme.test", nextStepAt: new Date("2026-10-20T00:00:00Z"), summary: "new" });
    expect(c).toEqual({ leadId: "l1", changed: ["stage", "owner"], previousStage: "contacted" });
  });

  it("counts a date moving and a blank being filled", () => {
    const c = leadChanges("l1", before, { nextStepAt: new Date("2026-10-21T00:00:00Z"), title: "VP Sales", stage: "contacted" });
    expect(c).toEqual({ leadId: "l1", changed: ["nextStepAt", "title"], previousStage: null });
  });

  it("treats null and a missing value as the same", () => {
    expect(leadChanges("l1", { company: null }, { company: undefined, domain: null }).changed).toEqual([]);
  });
});
