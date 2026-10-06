import { describe, expect, it } from "vitest";
import { DEFAULT_LINES, openAtStart, resolveLines, toSavedLines } from "./dashboard-lines";

describe("resolveLines", () => {
  it("uses the role's defaults when nothing is saved", () => {
    expect(resolveLines(null, "rep")).toEqual(DEFAULT_LINES.rep);
    expect(resolveLines({ v: 2, order: ["deals"] }, "manager")).toEqual(DEFAULT_LINES.manager);
  });

  it("keeps the saved order and drops lines the role can't have", () => {
    const saved = { v: 1, order: ["deals", "team", "next", "bogus"], hidden: ["next"], open: ["deals"] };
    const rep = resolveLines(saved, "rep");
    expect(rep.order.slice(0, 2)).toEqual(["deals", "next"]);
    expect(rep.order).not.toContain("team");
    expect(rep.hidden).toContain("next");
    expect(rep.hidden).not.toContain("deals");
    expect(rep.open).toEqual(["deals"]);
  });

  it("adds lines the person hasn't seen at the end, with their default visibility", () => {
    const saved = { v: 1, order: ["next", "today"], hidden: [], open: [] };
    const manager = resolveLines(saved, "manager");
    expect(manager.order.slice(0, 2)).toEqual(["next", "today"]);
    expect(manager.order).toHaveLength(DEFAULT_LINES.manager.order.length);
    expect(manager.hidden).toEqual(expect.arrayContaining(["saved", "renewals", "deal-value"]));
    expect(manager.hidden).not.toContain("team");
    expect(manager.open).toEqual(["team"]);
  });
});

describe("toSavedLines", () => {
  it("keeps only known line ids", () => {
    expect(toSavedLines({ order: ["team", "x", "team"], hidden: [1, "deals"], open: "next" })).toEqual({ v: 1, order: ["team"], hidden: ["deals"], open: [] });
  });
});

describe("openAtStart", () => {
  it("opens the picked lines plus the first urgent visible one", () => {
    const p: Parameters<typeof openAtStart>[0] = { order: ["team", "next", "today"], hidden: [], open: ["today"] };
    expect(openAtStart(p, { next: "urgent", today: "urgent" })).toEqual(["next", "today"]);
    expect(openAtStart({ ...p, hidden: ["next"] }, { next: "urgent", team: "due" })).toEqual(["today"]);
  });
});
