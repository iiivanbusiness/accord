import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findFirst: async ({ where }: { where: { email: { equals: string } } }) => (where.email.equals.toLowerCase() === "rep@example.com" ? { id: "u1" } : null) } },
}));

import { parseLeadInput } from "./api-leads";

describe("parseLeadInput", () => {
  it("cleans what it's given", async () => {
    const r = await parseLeadInput("w", { name: "  Ana  ", email: "Ana@Example.COM", phone: "+1 (202) 555-0150", domain: "https://acme.com/about", stage: "converted", nextStepAt: "2026-10-20", ownerEmail: "Rep@example.com" }, { requireName: true });
    expect("data" in r && r.data).toMatchObject({ name: "Ana", email: "ana@example.com", phone: "+12025550150", domain: "acme.com", stage: "converted", ownerId: "u1" });
    expect("data" in r && r.data.convertedAt).toBeInstanceOf(Date);
    expect("data" in r && r.data.nextStepAt?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
  it("only touches the keys that were sent, and null clears", async () => {
    const r = await parseLeadInput("w", { title: null, ownerEmail: null }, { requireName: false });
    expect("data" in r && r.data).toEqual({ title: null, ownerId: null });
  });
  it("explains what's wrong", async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{}, /name.*required/],
      [{ name: "" }, /required/],
      [{ name: "A", email: "nope" }, /email/],
      [{ name: "A", stage: "won" }, /stage/],
      [{ name: "A", interest: "lukewarm" }, /interest/],
      [{ name: "A", nextStepAt: "20/10/2026" }, /nextStepAt/],
      [{ name: "A", nextStepAt: "2026-13-45" }, /real date/],
      [{ name: "A", ownerEmail: "stranger@example.com" }, /ownerEmail/],
    ];
    for (const [body, msg] of cases) {
      const r = await parseLeadInput("w", body, { requireName: true });
      expect("error" in r && r.error, JSON.stringify(body)).toMatch(msg);
    }
  });
});
