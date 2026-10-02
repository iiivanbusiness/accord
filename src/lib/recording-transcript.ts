// Shared by the browser (a recording sent straight to Deepgram) and the
// server (the small-file fallback), so both give the same transcript.

// Diarized, single-track recordings: Deepgram tells speakers apart and
// numbers them from 0.
export const RECORDING_LISTEN_PARAMS = "model=nova-3&smart_format=true&punctuate=true&diarize=true&utterances=true";

type Utterance = { speaker?: number; transcript?: string };
type ListenResponse = {
  metadata?: { duration?: number };
  results?: { utterances?: Utterance[]; channels?: { alternatives?: { transcript?: string }[] }[] };
};

// One line per turn, "Speaker 1: ...", merging back-to-back utterances from
// the same person so a long answer reads as one turn.
export function transcriptFromListenResponse(data: ListenResponse): { transcript: string; seconds: number; turns: number } {
  const lines: { speaker: number; text: string }[] = [];
  for (const u of data.results?.utterances ?? []) {
    const text = u.transcript?.trim();
    if (!text) continue;
    const speaker = u.speaker ?? 0;
    const last = lines[lines.length - 1];
    if (last && last.speaker === speaker) last.text += ` ${text}`;
    else lines.push({ speaker, text });
  }
  const transcript = lines.length
    ? lines.map((l) => `Speaker ${l.speaker + 1}: ${l.text}`).join("\n")
    : (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "").trim();
  return { transcript, seconds: Math.round(data.metadata?.duration ?? 0), turns: lines.length };
}

// Zoom, Meet and Teams export captions as .vtt or .srt: drop the cue
// numbers and timings, turn "<v Name>text" into "Name: text", and join a
// speaker's consecutive lines.
export function transcriptFromCaptionFile(raw: string): string {
  const out: string[] = [];
  for (const block of raw.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => {
      const t = l.trim();
      return t && t !== "WEBVTT" && !t.startsWith("NOTE") && !/^\d+$/.test(t) && !t.includes("-->");
    });
    for (const line of lines) {
      const voice = line.match(/^<v\s+([^>]+)>(.*?)(<\/v>)?$/);
      const text = (voice ? `${voice[1].trim()}: ${voice[2]}` : line).replace(/<[^>]+>/g, "").trim();
      if (!text) continue;
      const prev = out[out.length - 1];
      const speaker = text.match(/^([^:]{1,40}):\s/)?.[1];
      if (prev && speaker && prev.startsWith(`${speaker}: `)) out[out.length - 1] = `${prev} ${text.slice(speaker.length + 2)}`;
      else out.push(text);
    }
  }
  return out.join("\n");
}
