import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === "hooks.example.com") return [{ address: "93.184.216.34", family: 4 }];
    if (host === "sneaky.example.com") return [{ address: "93.184.216.34", family: 4 }, { address: "10.1.2.3", family: 4 }];
    if (host === "metadata.example.com") return [{ address: "169.254.169.254", family: 4 }];
    throw new Error("ENOTFOUND");
  }),
}));

import { checkPublicHttpsUrl, isPrivateAddress } from "./outbound-url";

describe("isPrivateAddress", () => {
  it.each(["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])("%s is private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])("%s is public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("checkPublicHttpsUrl", () => {
  it("accepts a public https URL", async () => {
    expect(await checkPublicHttpsUrl("https://hooks.example.com/sealme")).toBeNull();
    expect(await checkPublicHttpsUrl("https://8.8.8.8/x")).toBeNull();
  });
  it("refuses http, credentials and junk", async () => {
    expect(await checkPublicHttpsUrl("http://hooks.example.com")).toMatch(/https/);
    expect(await checkPublicHttpsUrl("https://user:pw@hooks.example.com")).toMatch(/username/);
    expect(await checkPublicHttpsUrl("not a url")).toMatch(/valid/);
  });
  it("refuses internal names and addresses", async () => {
    for (const url of ["https://localhost/x", "https://api.localhost/x", "https://db.internal/x", "https://10.0.0.5/x", "https://[::1]/x", "https://metadata.example.com/", "https://sneaky.example.com/"]) {
      expect(await checkPublicHttpsUrl(url), url).toMatch(/reachable/);
    }
  });
  it("refuses a domain that doesn't resolve", async () => {
    expect(await checkPublicHttpsUrl("https://nope.example.com")).toMatch(/resolve/);
  });
});
