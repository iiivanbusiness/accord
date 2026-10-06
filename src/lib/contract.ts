export type Clause = { title: string; body: string };

export function fillClauses(clausesJson: string, fields: { fieldKey: string; value: string | null }[]): Clause[] {
  const values = Object.fromEntries(fields.filter((f) => f.value).map((f) => [f.fieldKey, f.value as string]));
  const clauses = JSON.parse(clausesJson) as Clause[];
  return clauses.map((c) => ({
    title: c.title,
    body: c.body.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`),
  }));
}

// Who a contract is with: the party its Parties clause names (the client's
// company when one was heard, else the person), or the client on file.
export function contractParty(fields: { fieldKey: string; value: string | null }[], client: { name: string; company?: string | null }): string {
  return fields.find((f) => f.fieldKey === "clientName")?.value?.trim() || client.company?.trim() || client.name;
}

export function extractPlaceholderKeys(clausesJson: string): string[] {
  const clauses = JSON.parse(clausesJson) as Clause[];
  const keys = new Set<string>();
  for (const clause of clauses) {
    for (const match of clause.body.matchAll(/\{(\w+)\}/g)) keys.add(match[1]);
  }
  return [...keys];
}
