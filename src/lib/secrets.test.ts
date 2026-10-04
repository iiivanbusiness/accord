import { beforeEach, describe, expect, it, vi } from "vitest";

async function load(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
  else process.env.SECRETS_ENCRYPTION_KEY = key;
  return import("./secrets");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("secrets", () => {
  it("round-trips, and never stores the plain value", async () => {
    const s = await load("test-key-one");
    const sealed = s.sealSecret("pat-eu1-1234");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("pat-eu1-1234");
    expect(s.openSecret(sealed)).toBe("pat-eu1-1234");
  });
  it("uses a fresh nonce every time", async () => {
    const s = await load("test-key-one");
    expect(s.sealSecret("same")).not.toBe(s.sealSecret("same"));
  });
  it("doesn't seal twice", async () => {
    const s = await load("test-key-one");
    const once = s.sealSecret("x");
    expect(s.sealSecret(once)).toBe(once);
  });
  it("reads values stored before encryption as they are", async () => {
    const s = await load("test-key-one");
    expect(s.openSecret("plain-old-token")).toBe("plain-old-token");
  });
  it("stores plainly when no key is set, and can't open sealed values then", async () => {
    const sealed = (await load("test-key-one")).sealSecret("secret");
    const s = await load(undefined);
    expect(s.canSealSecrets()).toBe(false);
    expect(s.sealSecret("secret")).toBe("secret");
    expect(s.openSecret(sealed)).toBeNull();
  });
  it("refuses a value sealed with another key or tampered with", async () => {
    const sealed = (await load("test-key-one")).sealSecret("secret");
    expect((await load("test-key-two")).openSecret(sealed)).toBeNull();
    const s = await load("test-key-one");
    const parts = sealed.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(s.openSecret(parts.join("."))).toBeNull();
  });
});
