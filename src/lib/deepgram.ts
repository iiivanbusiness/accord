export function isDeepgramConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

type DeepgramWord = { word: string; punctuated_word?: string; start: number };
type DeepgramResponse = {
  results?: {
    channels?: { alternatives?: { words?: DeepgramWord[] }[] }[];
  };
};

// Speaker labels by channel index — the desktop app's local-capture audio is
// always encoded left = system audio (the other person, since that's what
// plays through the speakers), right = microphone (you). See
// desktop-app/src-tauri/native/audio_capture.swift.
const CHANNEL_LABELS = ["Client", "You"];

// Batch (prerecorded) transcription of a full call, recorded locally on the
// user's machine. Multichannel rather than diarized: the two speakers are
// already on separate channels (system audio vs. mic), so we get reliable
// "who said what" from the channel index instead of guessed diarization.
export async function transcribeWav(wavBytes: Buffer): Promise<string> {
  // detect_language rather than a hardcoded language — calls happen in
  // whatever language the user and client actually speak, not just English.
  // Works per-channel with multichannel, and Nova-3 covers Serbian (sr).
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&multichannel=true&detect_language=true", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/wav",
    },
    body: new Uint8Array(wavBytes),
  });
  if (!res.ok) throw new Error(`Deepgram transcription failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as DeepgramResponse;
  const channels = data.results?.channels ?? [];

  const allWords: { text: string; start: number; speaker: string }[] = [];
  channels.forEach((channel, i) => {
    const words = channel.alternatives?.[0]?.words ?? [];
    const speaker = CHANNEL_LABELS[i] ?? `Speaker ${i}`;
    for (const w of words) {
      allWords.push({ text: w.punctuated_word ?? w.word, start: w.start, speaker });
    }
  });
  if (allWords.length === 0) return "";
  allWords.sort((a, b) => a.start - b.start);

  const lines: string[] = [];
  let currentSpeaker = allWords[0].speaker;
  let currentWords: string[] = [];
  for (const w of allWords) {
    if (w.speaker !== currentSpeaker) {
      lines.push(`${currentSpeaker}: ${currentWords.join(" ")}`);
      currentSpeaker = w.speaker;
      currentWords = [];
    }
    currentWords.push(w.text);
  }
  if (currentWords.length) lines.push(`${currentSpeaker}: ${currentWords.join(" ")}`);
  return lines.join("\n");
}
