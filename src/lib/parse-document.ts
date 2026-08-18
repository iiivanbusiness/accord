export async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // .txt or anything else: treat as plain text
  return buffer.toString("utf-8");
}

export type ParsedClause = { title: string; body: string };

// Splits contract text on numbered-heading lines like "1. Services" or "2) Fees".
// Falls back to a single clause if the document doesn't have that structure,
// so no text is ever silently dropped.
export function splitIntoClauses(text: string): ParsedClause[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");
  const headingRegex = /^[ \t]*(\d{1,2})[.)]\s+([A-Z][^\n]{2,70})[ \t]*$/gm;
  const matches = [...normalized.matchAll(headingRegex)];

  if (matches.length < 2) {
    const body = normalized.trim().replace(/\n{3,}/g, "\n\n");
    return [{ title: "Agreement Text", body: body.slice(0, 6000) || "Paste or edit the agreement text here." }];
  }

  const clauses: ParsedClause[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = match[2].trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : normalized.length;
    const body = normalized.slice(start, end).trim().replace(/\s+/g, " ");
    if (body) clauses.push({ title, body: body.slice(0, 3000) });
  }
  return clauses.length > 0 ? clauses : [{ title: "Agreement Text", body: normalized.trim().slice(0, 6000) }];
}
