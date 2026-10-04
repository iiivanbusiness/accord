import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/server", () => ({ after: () => {} }));

import { generateApiKey, hashApiKey } from "./api-auth";

describe("API keys", () => {
  it("are long, random and shown with a short prefix", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).toMatch(/^sk_live_[0-9a-f]{48}$/);
    expect(a.raw).not.toBe(b.raw);
    expect(a.prefix).toBe(a.raw.slice(0, 12));
  });
  it("are stored only as a SHA-256 hash", () => {
    const { raw } = generateApiKey();
    expect(hashApiKey(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(raw)).not.toContain(raw);
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });
});
