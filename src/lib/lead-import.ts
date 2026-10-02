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
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportRow = Partial<Record<ImportFieldKey, string>>;

export const MAX_IMPORT_ROWS = 10_000;
export const IMPORT_CHUNK_SIZE = 500;

// Header names as Apollo, Clay, HubSpot, Salesforce, and LinkedIn exports
// write them, lowercased with punctuation stripped.
const SYNONYMS: Record<ImportFieldKey, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact", "lead name", "person", "person name"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  company: ["company", "company name", "organization", "organisation", "organization name", "account", "account name", "employer"],
  title: ["title", "job title", "position", "role", "headline", "job"],
  email: ["email", "work email", "email address", "e mail", "business email", "primary email", "contact email"],
  phone: ["phone", "phone number", "mobile", "mobile phone", "mobile number", "direct phone", "work phone", "corporate phone", "cell", "cell phone", "telephone", "direct dial"],
  domain: ["website", "domain", "company domain", "company website", "website url", "url", "web", "company url"],
  ownerEmail: ["owner", "owner email", "owner email address", "lead owner", "contact owner", "account owner", "record owner", "hubspot owner", "sales rep", "sales rep email", "rep", "rep email", "assigned to", "assigned rep"],
};

// How a manager hands out the leads an import creates. Reps can't pick:
// their imports are always theirs.
export type ImportAssignment =
  | { mode: "one"; ownerId: string | null }
  | { mode: "even"; ownerIds: string[]; offset: number }
  | { mode: "column"; fallbackOwnerId: string | null };

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Best guess for each column, never using one field twice (the first
// column that matches wins), "" for columns to leave out.
export function guessMapping(headers: string[]): (ImportFieldKey | "")[] {
  const used = new Set<ImportFieldKey>();
  return headers.map((h) => {
    const n = normalizeHeader(h);
    const field = (Object.keys(SYNONYMS) as ImportFieldKey[]).find((k) => !used.has(k) && SYNONYMS[k].includes(n));
    if (field) used.add(field);
    return field ?? "";
  });
}

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
