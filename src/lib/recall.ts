import { Webhook } from "svix";

const API_BASE = "https://us-west-2.recall.ai/api/v1";

export function isRecallConfigured(): boolean {
  return Boolean(process.env.RECALL_API_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.RECALL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export function detectPlatformFromUrl(meetingUrl: string): string {
  return meetingUrl.includes("zoom.us") ? "zoom" : "meet";
}

export async function createCallBot(meetingUrl: string): Promise<{ id: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const res = await fetch(`${API_BASE}/bot/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: "SealMe Notetaker",
      recording_config: {
        transcript: {
          provider: { recallai_streaming: { mode: "prioritize_low_latency", language_code: "en" } },
          diarization: { use_separate_streams_when_available: true },
        },
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${appUrl}/api/recall/realtime`,
            events: ["transcript.data"],
          },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Recall bot creation failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ id: string }>;
}

type RecallBot = {
  id: string;
  recordings?: {
    media_shortcuts?: {
      transcript?: { data?: { download_url?: string } };
    };
  }[];
};

type TranscriptSegment = {
  participant?: { name?: string | null };
  words?: { text: string }[];
};

export async function fetchBotTranscript(botId: string): Promise<string> {
  const botRes = await fetch(`${API_BASE}/bot/${botId}/`, { headers: authHeaders() });
  if (!botRes.ok) throw new Error(`Couldn't fetch Recall bot ${botId}: ${botRes.status}`);
  const bot = (await botRes.json()) as RecallBot;

  const downloadUrl = bot.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url;
  if (!downloadUrl) throw new Error(`No transcript available yet for bot ${botId}`);

  const transcriptRes = await fetch(downloadUrl);
  if (!transcriptRes.ok) throw new Error(`Couldn't download transcript: ${transcriptRes.status}`);
  const segments = (await transcriptRes.json()) as TranscriptSegment[];

  return segments
    .map((segment) => {
      const speaker = segment.participant?.name ?? "Speaker";
      const text = (segment.words ?? []).map((w) => w.text).join(" ");
      return text ? `${speaker}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function verifyRecallWebhook(payload: string, headers: Record<string, string>): Promise<unknown> {
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) throw new Error("RECALL_WEBHOOK_SECRET isn't set");
  const wh = new Webhook(secret);
  return wh.verify(payload, headers);
}

type RealtimeTranscriptEvent = {
  event: string;
  data: {
    bot: { id: string };
    data: {
      words?: { text: string }[];
      participant?: { name?: string | null };
    };
  };
};

export function parseRealtimeTranscriptEvent(event: unknown): { botId: string; speaker: string; text: string } | null {
  const e = event as RealtimeTranscriptEvent;
  if (e?.event !== "transcript.data") return null;
  const botId = e.data?.bot?.id;
  const text = (e.data?.data?.words ?? []).map((w) => w.text).join(" ").trim();
  if (!botId || !text) return null;
  const speaker = e.data?.data?.participant?.name ?? "Speaker";
  return { botId, speaker, text };
}
