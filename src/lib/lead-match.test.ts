import { describe, expect, it } from "vitest";
import { mergeList, pickLeadMatch } from "./lead-match";
import { overviewLines } from "./lead-overview";

const lead = (id: string, o: Partial<{ name: string; company: string | null; email: string | null; phone: string | null; lastContactedAt: Date | null }> = {}) => ({
  id,
  name: "Megan Ellis",
  company: "Brightwater Coffee Roasters",
  email: null,
  phone: null,
  lastContactedAt: null,
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...o,
});
const probe = (o: Partial<{ name: string | null; company: string | null; email: string | null; phone: string | null }> = {}) => ({
  name: "Megan Ellis",
  company: "Brightwater Coffee Roasters",
  email: null,
  phone: null,
  ...o,
});

describe("pickLeadMatch", () => {
  it("matches the same name at the same company, ignoring case and suffixes", () => {
    const hit = pickLeadMatch([lead("a", { company: "Brightwater Coffee Roasters, Inc." })], probe({ name: "megan ellis", company: "brightwater coffee roasters" }));
    expect(hit?.id).toBe("a");
  });

  it("matches a shorter company name and a first name only at that company", () => {
    expect(pickLeadMatch([lead("a")], probe({ name: "Megan", company: "Brightwater" }))?.id).toBe("a");
  });

  it("doesn't match the same name at a different company", () => {
    expect(pickLeadMatch([lead("a")], probe({ company: "Northgate Fitness" }))).toBeNull();
  });

  it("doesn't match a different person at the same company", () => {
    expect(pickLeadMatch([lead("a")], probe({ name: "Jordan Reyes" }))).toBeNull();
  });

  it("settles it by email or phone whatever the name", () => {
    expect(pickLeadMatch([lead("a", { email: "megan@bw.example", name: "M. Ellis" })], probe({ name: "Meg", email: "megan@bw.example" }))?.id).toBe("a");
    expect(pickLeadMatch([lead("a", { phone: "+14155550100", company: null })], probe({ name: null, company: null, phone: "+14155550100" }))?.id).toBe("a");
  });

  it("without a company needs the full name, not a first name", () => {
    expect(pickLeadMatch([lead("a", { company: null })], probe({ company: null }))?.id).toBe("a");
    expect(pickLeadMatch([lead("a", { company: null })], probe({ name: "Megan", company: null }))).toBeNull();
  });

  it("picks the lead worked most recently when several match", () => {
    const hit = pickLeadMatch(
      [lead("old", { lastContactedAt: new Date("2026-09-01T00:00:00Z") }), lead("new", { lastContactedAt: new Date("2026-10-06T00:00:00Z") })],
      probe(),
    );
    expect(hit?.id).toBe("new");
  });

  it("returns nothing when the call named nobody", () => {
    expect(pickLeadMatch([lead("a")], probe({ name: null }))).toBeNull();
  });
});

describe("mergeList", () => {
  it("keeps the newer items first and drops repeats", () => {
    expect(mergeList("No budget; Needs legal", "needs legal; Busy season")).toBe("No budget; Needs legal; Busy season");
    expect(mergeList(null, null)).toBeNull();
  });
});

describe("overviewLines", () => {
  it("keeps only bullet lines, as \"- \" bullets, without em dashes", () => {
    expect(overviewLines("Here you go:\n- Agreed on $4,500 — monthly\n* Start Nov 1\nThanks")).toBe("- Agreed on $4,500, monthly\n- Start Nov 1");
    expect(overviewLines("nothing useful")).toBeNull();
  });
});
