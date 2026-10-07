import { describe, expect, it } from "vitest";
import { feeCurrency, parseFee } from "./money";

describe("parseFee", () => {
  it("reads US and European grouping", () => {
    expect(parseFee("$2,500.00")).toBe(2500);
    expect(parseFee("€150.000,00")).toBe(150000);
    expect(parseFee("$4,000 a month")).toBe(4000);
    expect(parseFee("12,50 EUR")).toBe(12.5);
  });
  it("scales thousands and millions", () => {
    expect(parseFee("$8.5k")).toBe(8500);
    expect(parseFee("$1.2M a year")).toBe(1_200_000);
    expect(parseFee("2 million")).toBe(2_000_000);
    expect(parseFee("$40K")).toBe(40000);
  });
  it("doesn't mistake a word for a scale", () => {
    expect(parseFee("$3,000 monthly")).toBe(3000);
    expect(parseFee("$500 min")).toBe(500);
    expect(parseFee("TBD")).toBe(0);
  });
});

describe("feeCurrency", () => {
  it("reads the sign or the code", () => {
    expect(feeCurrency("$8,500")).toBe("USD");
    expect(feeCurrency("CA$8,500")).toBe("CAD");
    expect(feeCurrency("€2.500")).toBe("EUR");
    expect(feeCurrency("£900 a month")).toBe("GBP");
    expect(feeCurrency("2500 eur")).toBe("EUR");
    expect(feeCurrency("8,500")).toBeNull();
  });
});
