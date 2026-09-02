// A small hand-rolled CSV parser — no dependency pulled in for something
// this contained. Handles quoted fields (including embedded commas,
// newlines, and "" as an escaped quote) and both \n and \r\n line endings.
// Returns rows as plain string arrays; the caller maps the header row to
// field names.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const chars = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuotes) {
      if (c === '"') {
        if (chars[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Last field/row, if the text didn't end on a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

// Parses CSV text with a header row into an array of { header: value }
// objects, keyed by lowercased/trimmed header names.
export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}
