// Shared by the import screen (column matching, preview) and the server
// action that writes the rows, so both agree on what each column means.

export const IMPORT_FIELDS = [
  { key: "name", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "domain", label: "Website" },
  // Managers only: who the lead goes to, by their SealMe login email.
  { key: "ownerEmail", label: "Owner email" },
  // Any number of columns can go here; each becomes a "Header: value" line.
  { key: "notes", label: "Notes" },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportRow = Partial<Record<ImportFieldKey, string>>;

// Fields more than one column can be matched to.
export const MULTI_FIELDS: ReadonlySet<ImportFieldKey> = new Set(["notes"]);

export const MAX_IMPORT_ROWS = 10_000;
export const IMPORT_CHUNK_SIZE = 500;

// Header names as Apollo, Clay, HubSpot, Salesforce, and LinkedIn exports
// write them, plus Serbian/Croatian/Bosnian ones, compared after
// lowercasing, dropping accents, and turning punctuation into spaces.
const SYNONYMS: Record<ImportFieldKey, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact", "lead name", "person", "person name", "ime", "ime i prezime", "puno ime", "kontakt", "osoba"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name", "prezime"],
  company: ["company", "company name", "organization", "organisation", "organization name", "account", "account name", "employer", "kompanija", "firma", "preduzece", "naziv firme", "naziv kompanije", "organizacija"],
  title: ["title", "job title", "position", "role", "headline", "job", "titula", "pozicija", "funkcija", "zvanje", "radno mesto", "radno mjesto"],
  email: ["email", "work email", "email address", "e mail", "business email", "primary email", "contact email", "mejl", "imejl", "email adresa", "e mail adresa", "mail"],
  phone: ["phone", "phone number", "mobile", "mobile phone", "mobile number", "direct phone", "work phone", "corporate phone", "cell", "cell phone", "telephone", "direct dial", "telefon", "broj telefona", "mobilni", "mobilni telefon", "tel", "broj"],
  domain: ["website", "domain", "company domain", "company website", "website url", "url", "web", "company url", "sajt", "veb sajt", "web sajt", "internet stranica", "domen"],
  ownerEmail: ["owner", "owner email", "owner email address", "lead owner", "contact owner", "account owner", "record owner", "hubspot owner", "sales rep", "sales rep email", "rep", "rep email", "assigned to", "assigned rep", "vlasnik", "prodavac", "zaduzen"],
  notes: ["notes", "note", "comments", "comment", "description", "remarks", "napomena", "napomene", "beleska", "beleske", "biljeska", "biljeske", "komentar", "komentari", "opis"],
};

// Headers that start with a field's name but mean something else about it
// ("Email Status", "Phone Type"), so the loose second pass skips them.
const NOT_THE_VALUE = /\b(status|type|tip|verified|valid|count|score|source|date|datum|id)\b/;

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Best guess for each column, "" for columns to leave out. An exact header
// match wins; then a header that starts with a known name ("Prezime
// (skriveno)", "Telefon 1"). Single-value fields are used once, by the
// first column that matches.
export function guessMapping(headers: string[]): (ImportFieldKey | "")[] {
  const fields = Object.keys(SYNONYMS) as ImportFieldKey[];
  const normalized = headers.map(normalizeHeader);
  const result: (ImportFieldKey | "")[] = headers.map(() => "");
  const used = new Set<ImportFieldKey>();
  const take = (i: number, field: ImportFieldKey) => {
    result[i] = field;
    if (!MULTI_FIELDS.has(field)) used.add(field);
  };

  normalized.forEach((n, i) => {
    const field = fields.find((k) => (MULTI_FIELDS.has(k) || !used.has(k)) && SYNONYMS[k].includes(n));
    if (field) take(i, field);
  });
  normalized.forEach((n, i) => {
    if (result[i] || NOT_THE_VALUE.test(n)) return;
    const field = fields.find((k) => (MULTI_FIELDS.has(k) || !used.has(k)) && SYNONYMS[k].some((syn) => n.startsWith(`${syn} `)));
    if (field) take(i, field);
  });

  // "Name" or "Ime" next to a last-name column is the first name.
  if (used.has("lastName") && !used.has("firstName")) {
    const nameIndex = result.indexOf("name");
    if (nameIndex >= 0) result[nameIndex] = "firstName";
  }
  return result;
}

// True when the header itself already says "notes", so its value goes in
// as-is instead of as "Header: value".
export function isNotesHeader(header: string): boolean {
  return SYNONYMS.notes.includes(normalizeHeader(header));
}

// How a manager hands out the leads an import creates. Reps can't pick:
// their imports are always theirs.
export type ImportAssignment =
  | { mode: "one"; ownerId: string | null }
  | { mode: "even"; ownerIds: string[]; offset: number }
  | { mode: "column"; fallbackOwnerId: string | null };

// Pasted text from Excel or Sheets is tab-separated; a CSV file is
// comma-separated. Whichever appears more in the header line wins.
export function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

export function rowName(row: ImportRow): string {
  return (row.name?.trim() || [row.firstName?.trim(), row.lastName?.trim()].filter(Boolean).join(" ")).trim();
}
