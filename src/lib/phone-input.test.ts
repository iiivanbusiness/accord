import { describe, expect, it } from "vitest";
import { composePhone, countryByCode, countryFromLocale, flagEmoji, searchCountries, splitPhone } from "./phone-input";

const RS = countryByCode("RS")!;
const US = countryByCode("US")!;
const IT = countryByCode("IT")!;
const RU = countryByCode("RU")!;

describe("Phone number with a country list", () => {
  it("lists countries by their first letters", () => {
    const s = searchCountries("s").map((c) => c.name);
    expect(s[0].startsWith("S")).toBe(true);
    expect(s).toContain("Serbia");
    expect(searchCountries("ser")[0].name).toBe("Serbia");
    expect(searchCountries("united").map((c) => c.code)).toEqual(expect.arrayContaining(["US", "GB", "AE"]));
    expect(searchCountries("+381")[0].code).toBe("RS");
    expect(searchCountries("zzz")).toEqual([]);
  });

  it("builds the full number, dropping the 0 dialed at home", () => {
    expect(composePhone(RS, "064 123 4567")).toBe("+381641234567");
    expect(composePhone(RS, "64 123 4567")).toBe("+381641234567");
    expect(composePhone(US, "(512) 555-0100")).toBe("+15125550100");
    expect(composePhone(US, "1 512 555 0100")).toBe("+15125550100");
    expect(composePhone(RU, "8 912 123 4567")).toBe("+79121234567");
    // Italian numbers keep their 0.
    expect(composePhone(IT, "06 1234 5678")).toBe("+390612345678");
    expect(composePhone(RS, "+44 7700 900123")).toBe("+447700900123");
    expect(composePhone(RS, "")).toBe("");
  });

  it("finds the country of a saved number", () => {
    expect(splitPhone("+381641234567")).toEqual({ country: RS, local: "641234567" });
    expect(splitPhone("+15125550100")?.country.code).toBe("US");
    expect(splitPhone("+447700900123")?.country.code).toBe("GB");
    expect(splitPhone("")).toBeNull();
  });

  it("guesses from the browser and draws the flag", () => {
    expect(countryFromLocale("sr-RS")?.code).toBe("RS");
    expect(countryFromLocale("en")).toBeNull();
    expect(flagEmoji("RS")).toBe("🇷🇸");
  });
});
