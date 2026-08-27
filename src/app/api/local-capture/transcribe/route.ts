import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { transcribeWav, isDeepgramConfigured } from "@/lib/deepgram";
import { applyExtractionToDeal } from "@/lib/deal-live";
import { extractPlaceholderKeys } from "@/lib/contract";
import { autoGenerateAndSendContract } from "@/lib/auto-send";
import { sendAdminAlertEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Receives a chunk of a locally-recorded call from the desktop app's native
// capture bridge, authenticated with a token minted by startLocalCapture —
// not a session cookie, since this request comes from Rust, not the webview.
//
// Called repeatedly while the call is still going (?final=false, roughly
// once a minute — see begin_live_updates in the Rust side) so deal terms
// fill in live the same way they do for a Recall bot call, and once more
// when the call ends (?final=true), which is the only call that burns the
// token, checks auto-send, and can mark the deal extraction_failed.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const isFinal = new URL(req.url).searchParams.get("final") === "true";

  // A live call pings this roughly once a minute for its whole duration —
  // a tight per-token limit would legitimately trip on a normal-length call.
  const allowed = await checkRateLimit(`local-capture:${hashToken(token)}`, 120, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const record = await prisma.localCaptureToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Single-use only in the sense that a *finalized* token can't be reused —
  // non-final (live) pings reuse the same token for the whole call, and only
  // the final call actually burns it.
  if (isFinal) {
    await prisma.localCaptureToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  }

  const deal = await prisma.deal.findUnique({ where: { id: record.dealId }, include: { template: true, workspace: true } });
  if (!deal || !deal.template) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  if (!isDeepgramConfigured()) {
    if (isFinal) await prisma.deal.update({ where: { id: deal.id }, data: { status: "extraction_failed" } });
    return NextResponse.json({ error: "Transcription isn't configured" }, { status: 500 });
  }

  const audioBuffer = Buffer.from(await req.arrayBuffer());
  const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);

  try {
    // A chunk can be empty on the final call (e.g. the call was stopped in
    // the same instant as the last periodic ping) — nothing new to
    // transcribe, but we still need to run the finalize steps below.
    if (audioBuffer.length > 0) {
      const chunkTranscript = await transcribeWav(audioBuffer);
      if (chunkTranscript) {
        await prisma.$executeRaw`UPDATE "Deal" SET "liveTranscript" = COALESCE("liveTranscript", '') || ${`\n${chunkTranscript}`} WHERE id = ${deal.id}`;
      }
    }

    const fresh = await prisma.deal.findUnique({ where: { id: deal.id } });
    const { hasMissing } = await applyExtractionToDeal(deal.id, fresh?.liveTranscript ?? "", placeholderKeys);

    if (isFinal) {
      if (!hasMissing && !deal.workspace.requireApproval) {
        await autoGenerateAndSendContract(deal.id);
      }
      await logAudit({ workspaceId: deal.workspaceId, action: "deal.local_capture_transcribed", targetType: "deal", targetId: deal.id });
    }

    return NextResponse.json({ ok: true, dealId: deal.id, final: isFinal });
  } catch (err) {
    console.error(`Local capture transcription failed for deal ${deal.id} (final=${isFinal})`, err);
    if (!isFinal) {
      // Soft-fail mid-call, same as the Recall realtime webhook — one bad
      // chunk shouldn't derail a deal that's still being recorded.
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    if (deal.status !== "sent" && deal.status !== "signed") {
      await prisma.deal.update({ where: { id: deal.id }, data: { status: "extraction_failed" } });
    }
    try {
      await sendAdminAlertEmail({
        subject: "Local capture transcription failed",
        details: `Workspace: ${deal.workspace.name} (${deal.workspaceId})\nDeal: ${deal.id}\n\n${err instanceof Error ? err.stack ?? err.message : String(err)}`,
      });
    } catch (alertErr) {
      console.error("Failed to send admin alert email", alertErr);
    }
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
