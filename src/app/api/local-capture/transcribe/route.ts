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

// Receives a locally-recorded call (WAV, raw body) from the desktop app's
// native capture bridge, authenticated with a short-lived single-use token
// minted by startLocalCapture — not a session cookie, since this request
// comes from Rust, not the webview. Mirrors what the Recall webhook does
// once a bot's recording is done: transcribe, extract, maybe auto-send.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const allowed = await checkRateLimit(`local-capture:${hashToken(token)}`, 5, 15 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const record = await prisma.localCaptureToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Single-use: burn it immediately so a retried/duplicated request can't
  // transcribe (and bill) the same call twice.
  await prisma.localCaptureToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const deal = await prisma.deal.findUnique({ where: { id: record.dealId }, include: { template: true, workspace: true } });
  if (!deal || !deal.template) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  if (!isDeepgramConfigured()) {
    await prisma.deal.update({ where: { id: deal.id }, data: { status: "extraction_failed" } });
    return NextResponse.json({ error: "Transcription isn't configured" }, { status: 500 });
  }

  const audioBuffer = Buffer.from(await req.arrayBuffer());
  if (audioBuffer.length === 0) {
    await prisma.deal.update({ where: { id: deal.id }, data: { status: "extraction_failed" } });
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }

  try {
    const transcript = await transcribeWav(audioBuffer);
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    const { hasMissing } = await applyExtractionToDeal(deal.id, transcript, placeholderKeys);

    if (!hasMissing && !deal.workspace.requireApproval) {
      await autoGenerateAndSendContract(deal.id);
    }

    await logAudit({ workspaceId: deal.workspaceId, action: "deal.local_capture_transcribed", targetType: "deal", targetId: deal.id });
    return NextResponse.json({ ok: true, dealId: deal.id });
  } catch (err) {
    console.error(`Local capture transcription failed for deal ${deal.id}`, err);
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
