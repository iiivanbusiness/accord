import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { generateCallRecapScript, synthesizeSpeech, isFishAudioConfigured } from "@/lib/call-recap";

// Played once, right when a locally-recorded call is stopped (see
// LocalCaptureBanner) — a spoken recap of what the call produced. This is a
// nice-to-have on top of the real extraction flow, not part of it: any
// failure here (not configured, no session, nothing extracted yet, Fish
// Audio outage) returns 204 so the caller just skips playing anything,
// same "never block the real thing" contract as the Slack/webhook
// notifications elsewhere in this app.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isFishAudioConfigured()) return new NextResponse(null, { status: 204 });

  const session = await auth();
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) return new NextResponse(null, { status: 204 });

  const { id } = await params;
  const { where } = await dealVisibilityFilter();
  const deal = await prisma.deal.findFirst({ where: { id, workspaceId, ...where } });
  if (!deal) return new NextResponse(null, { status: 204 });

  try {
    const script = await generateCallRecapScript(id);
    if (!script) return new NextResponse(null, { status: 204 });

    const audio = await synthesizeSpeech(script);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`Call recap generation failed for deal ${id}`, err);
    return new NextResponse(null, { status: 204 });
  }
}
