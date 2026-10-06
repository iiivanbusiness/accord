import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("Phone numbers", () => {
  it("keeps US numbers working as before", () => {
    expect(normalizePhone("(512) 555-0100")).toBe("+15125550100");
    expect(normalizePhone("1 512 555 0100")).toBe("+15125550100");
    expect(normalizePhone("+1 512 555 0100")).toBe("+15125550100");
  });

  it("takes international numbers written with + or 00", () => {
    expect(normalizePhone("+381 64 123 4567")).toBe("+381641234567");
    expect(normalizePhone("00381 64 123 4567")).toBe("+381641234567");
    expect(normalizePhone("0044 7700 900123")).toBe("+447700900123");
  });

  it("refuses what it can't place", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("381641234567")).toBeNull();
    // A local number with its leading 0 isn't a US number.
    expect(normalizePhone("064 123 4567")).toBeNull();
    expect(normalizePhone("1 012 555 0100")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
