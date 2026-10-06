import { COUNTRIES, MAIN_COUNTRY_FOR_DIAL, type Country } from "@/lib/countries";

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | null {
  return code ? (BY_CODE.get(code.toUpperCase()) ?? null) : null;
}

// 🇷🇸 from "RS": two regional indicator letters.
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// Typing "s" lists countries starting with S first, then ones with a word
// starting with S ("South Africa" before "Russia"), then any other match.
// "+38" or "38" searches calling codes.
export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const digits = q.replace(/^\+/, "");
  if (/^\d+$/.test(digits)) return COUNTRIES.filter((c) => c.dial.startsWith(digits)).sort((a, b) => a.dial.length - b.dial.length);
  const starts: Country[] = [];
  const wordStarts: Country[] = [];
  const contains: Country[] = [];
  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) starts.push(c);
    else if (name.split(/[\s(-]+/).some((w) => w.startsWith(q))) wordStarts.push(c);
    else if (name.includes(q) || c.code.toLowerCase() === q) contains.push(c);
  }
  return [...starts, ...wordStarts, ...contains];
}

// The full number from a country and what the person typed after it. The
// 0 people dial at home (8 in Russia, 1 in the US) is dropped, and a
// number pasted with its own +code is taken as is.
export function composePhone(country: Country, local: string): string {
  const typed = local.trim();
  if (typed.startsWith("+")) {
    const all = typed.replace(/\D/g, "");
    return all ? `+${all}` : "";
  }
  let digits = typed.replace(/\D/g, "");
  if (country.trunk && digits.startsWith(country.trunk) && digits.length > country.trunk.length + 4) digits = digits.slice(country.trunk.length);
  return digits ? `+${country.dial}${digits}` : "";
}

// The other way: which country a saved +number belongs to, and the rest.
export function splitPhone(e164: string | null | undefined): { country: Country; local: string } | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  if (!e164?.startsWith("+") || !digits) return null;
  for (let len = 4; len >= 1; len--) {
    const code = MAIN_COUNTRY_FOR_DIAL[digits.slice(0, len)];
    const country = countryByCode(code);
    if (country) return { country, local: digits.slice(len) };
  }
  return null;
}

// "sr-RS" → Serbia, for a first guess before anything is saved.
export function countryFromLocale(locale: string | null | undefined): Country | null {
  const region = locale?.split(/[-_]/)[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? countryByCode(region) : null;
}
