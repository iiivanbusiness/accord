import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export function isFishAudioConfigured(): boolean {
  return Boolean(process.env.FISH_AUDIO_API_KEY);
}

// A short, natural-sounding spoken recap of what a call produced — read
// aloud right when the rep stops a locally-recorded call, so they hear a
// human-style confirmation instead of having to read the deal page. Reuses
// the same summary/fields the live extraction already produced; this is
// just a second, small pass that turns them into something meant to be
// heard rather than read (no bullet points, no "Field: Value" recitation).
// Returns null when there's nothing worth reading back yet (call ended
// before anything was captured) — the caller treats that as "skip it".
export async function generateCallRecapScript(dealId: string): Promise<string | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { fields: true },
  });
  if (!deal) return null;

  const filled = deal.fields.filter((f) => f.value && f.status !== "missing");
  if (filled.length === 0 && !deal.summary) return null;

  const fieldLines = filled.map((f) => `${f.label}: ${f.value}`).join("\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system:
      "You just finished listening in on a sales call and filled in a contract from what was said. " +
      "Write a short, warm, spoken-style recap for the rep who was on the call — 3 to 4 sentences, like a " +
      "colleague reporting back, not a form reading out field names. Mention the client/company and the key " +
      "terms naturally in flowing sentences. End by inviting them to fix anything that's off before it goes " +
      "out. Match the language of the call summary and field values below — if they're in Serbian, reply in " +
      "Serbian. Output only the spoken text itself — no headers, no bullet points, no quotation marks.",
    messages: [
      {
        role: "user",
        content: `Call summary: ${deal.summary ?? "(none)"}\n\nFilled fields:\n${fieldLines || "(none yet)"}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : null;
}

// Fish Audio's TTS endpoint — see docs.fish.audio. FISH_AUDIO_MODEL defaults
// to their free, unlimited-under-fair-use S2.1 Pro model; FISH_AUDIO_VOICE_ID
// is optional (a specific voice's reference_id from the Fish Audio voice
// library — omit it to get their default voice).
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error("FISH_AUDIO_API_KEY isn't set");

  const res = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model: process.env.FISH_AUDIO_MODEL || "s2.1-pro-free",
    },
    body: JSON.stringify({
      text,
      format: "mp3",
      ...(process.env.FISH_AUDIO_VOICE_ID ? { reference_id: process.env.FISH_AUDIO_VOICE_ID } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Fish Audio TTS failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
