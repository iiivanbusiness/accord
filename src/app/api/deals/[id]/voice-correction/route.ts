import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { transcribeVoiceClip, isDeepgramConfigured } from "@/lib/deepgram";
import { interpretVoiceCorrection } from "@/lib/voice-correction";
import { synthesizeSpeech, isFishAudioConfigured } from "@/lib/call-recap";
import { checkRateLimit } from "@/lib/rate-limit";

// One push-to-talk turn: transcribe -> interpret as a single proposed field
// change -> synthesize a spoken confirmation question. Never writes
// anything — applying the change is a separate step (applyVoiceFieldCorrection
// in deals/[id]/actions.ts) the rep triggers explicitly after hearing the
// confirmation back, so a misheard word surfaces as an odd-sounding
// confirmation instead of a silently wrong contract.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isDeepgramConfigured()) return NextResponse.json({ error: "Voice correction isn't configured" }, { status: 503 });

  const { id } = await params;
  const { where } = await dealVisibilityFilter();
  const deal = await prisma.deal.findFirst({ where: { id, workspaceId, ...where } });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const allowed = await checkRateLimit(`voice-correction:${deal.id}`, 30, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });

  const contentType = req.headers.get("content-type") || "audio/webm";
  const audioBytes = Buffer.from(await req.arrayBuffer());
  if (audioBytes.length === 0) return NextResponse.json({ error: "No audio received" }, { status: 400 });

  try {
    const transcript = await transcribeVoiceClip(audioBytes, contentType);
    if (!transcript.trim()) return NextResponse.json({ error: "Didn't catch anything — try holding the button a bit longer" });

    const proposal = await interpretVoiceCorrection(id, transcript);
    if (!proposal) return NextResponse.json({ error: "Nothing to correct yet — the call hasn't produced any fields" });

    let audioBase64: string | null = null;
    if (isFishAudioConfigured()) {
      try {
        const audio = await synthesizeSpeech(proposal.confirmationText);
        audioBase64 = audio.toString("base64");
      } catch (err) {
        console.error(`Voice correction TTS failed for deal ${id}`, err);
      }
    }

    return NextResponse.json({ transcript, proposal, audioBase64 });
  } catch (err) {
    console.error(`Voice correction failed for deal ${id}`, err);
    return NextResponse.json({ error: "Something went wrong understanding that — try again" }, { status: 500 });
  }
}
