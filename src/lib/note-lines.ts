// A call's notes (or "where things stand") as separate points: the model
// writes "- " lines, sometimes with the line breaks spelled out as "\n".
export function noteLines(notes: string): string[] {
  return notes.split(/\n|\\n/).map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
}
