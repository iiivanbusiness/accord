import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDeepgramConfigured } from "@/lib/deepgram";
import { checkRateLimit } from "@/lib/rate-limit";
import { RECORDING_LISTEN_PARAMS } from "@/lib/recording-transcript";

// A call recording can be hundreds of MB, far past what a serverless
// request accepts, so the browser sends it straight to Deepgram. This hands
// it a short-lived Deepgram token for that one upload; the real key never
// leaves the server. If the key isn't allowed to mint tokens, the browser
// falls back to /api/recordings/transcribe, which only takes small files.
export async function POST() {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isDeepgramConfigured()) return NextResponse.json({ error: "Recording uploads aren't set up yet" }, { status: 503 });

  const allowed = await checkRateLimit(`recording-token:${workspaceId}`, 60, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many uploads. Try again later" }, { status: 429 });

  const language = process.env.DEEPGRAM_LANGUAGE || "en";
  const listenUrl = `https://api.deepgram.com/v1/listen?${RECORDING_LISTEN_PARAMS}&language=${language}`;
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
      // Only has to be valid when the upload starts.
      body: JSON.stringify({ ttl_seconds: 300 }),
    });
    if (!res.ok) return NextResponse.json({ mode: "proxy" });
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return NextResponse.json({ mode: "proxy" });
    return NextResponse.json({ mode: "direct", token: data.access_token, listenUrl });
  } catch {
    return NextResponse.json({ mode: "proxy" });
  }
}
