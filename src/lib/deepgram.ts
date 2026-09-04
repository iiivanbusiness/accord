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
  // detect_language turned out unreliable for Serbian specifically — tested
  // side by side, it misclassified Slavic speech as Polish/Russian and
  // produced garbled text, while explicitly setting the language transcribed
  // correctly. DEEPGRAM_LANGUAGE lets this be overridden per deployment;
  // defaults to Serbian since that's this workspace's actual call language
  // today. TODO before onboarding non-Serbian-speaking customers: make this
  // a per-workspace setting instead of one env-wide default.
  const language = process.env.DEEPGRAM_LANGUAGE || "sr";
  const res = await fetch(`https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&multichannel=true&language=${language}`, {
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

// A single, single-speaker push-to-talk clip — e.g. a spoken correction
// given right after the call-recap plays (see voice-correction.ts). Simpler
// than transcribeWav on purpose: one channel, no diarization, just the
// plain transcript text. contentType is whatever the browser's
// MediaRecorder produced (typically audio/webm) — Deepgram accepts it
// directly, no client-side conversion to WAV needed.
export async function transcribeVoiceClip(audioBytes: Buffer, contentType: string): Promise<string> {
  const language = process.env.DEEPGRAM_LANGUAGE || "sr";
  const res = await fetch(`https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=${language}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": contentType || "audio/webm",
    },
    body: new Uint8Array(audioBytes),
  });
  if (!res.ok) throw new Error(`Deepgram transcription failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}
