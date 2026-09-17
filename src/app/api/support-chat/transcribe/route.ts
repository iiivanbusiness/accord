import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transcribeVoiceClip, isDeepgramConfigured } from "@/lib/deepgram";
import { checkRateLimit } from "@/lib/rate-limit";

// Turns a short push-to-talk clip from the AI chat's mic button into text —
// separate from the message-sending call itself (support-chat/route.ts),
// so a bad/empty recording never burns one of the workspace's monthly AI
// chat messages. Cheap (Deepgram, not Anthropic), so a per-workspace rate
// limit is enough — no monthly counter like aiChatMessagesLimit.
export async function POST(req: Request) {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isDeepgramConfigured()) return NextResponse.json({ error: "Voice input isn't configured" }, { status: 503 });

  const allowed = await checkRateLimit(`support-chat-voice:${workspaceId}`, 30, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many voice clips — try again later" }, { status: 429 });

  const contentType = req.headers.get("content-type") || "audio/webm";
  const audioBytes = Buffer.from(await req.arrayBuffer());
  if (audioBytes.length === 0) return NextResponse.json({ error: "No audio received" }, { status: 400 });

  try {
    const transcript = await transcribeVoiceClip(audioBytes, contentType);
    if (!transcript.trim()) return NextResponse.json({ error: "Didn't catch anything, try again" }, { status: 200 });
    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("Support chat voice transcription failed", err);
    return NextResponse.json({ error: "Couldn't transcribe that clip" }, { status: 502 });
  }
}
