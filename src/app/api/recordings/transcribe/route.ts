import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDeepgramConfigured } from "@/lib/deepgram";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";
import { RECORDING_LISTEN_PARAMS, transcriptFromListenResponse } from "@/lib/recording-transcript";

// Transcribing a long recording takes Deepgram a while.
export const maxDuration = 300;

// Fallback for when /api/recordings/token can't mint a direct-upload token:
// the recording comes through here instead. Hosting caps a request body at
// a few MB, so this only suits short clips; the page says so.
export async function POST(req: Request) {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isDeepgramConfigured()) return NextResponse.json({ error: "Recording uploads aren't set up yet" }, { status: 503 });

  const allowed = await checkRateLimit(`recording-transcribe:${workspaceId}`, 30, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many uploads. Try again later" }, { status: 429 });

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ error: "No recording received" }, { status: 400 });

  const language = process.env.DEEPGRAM_LANGUAGE || "en";
  try {
    const res = await fetch(`https://api.deepgram.com/v1/listen?${RECORDING_LISTEN_PARAMS}&language=${language}`, {
      method: "POST",
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": contentType },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`);
    return NextResponse.json(transcriptFromListenResponse(await res.json()));
  } catch (err) {
    await reportError(err, "Recording transcription", { workspaceId });
    return NextResponse.json({ error: "Couldn't transcribe that recording" }, { status: 502 });
  }
}
