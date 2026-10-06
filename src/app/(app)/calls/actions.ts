"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { dropRecording, runCallProcessing } from "@/lib/call-inbox";
import { cookieTimeZone } from "@/lib/viewer-time";

const MAX_CHARS = 100_000;

// Whose calls someone may act on: their own, or everyone's for people who
// see all deals or run the team.
async function callScope() {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const seesAll = access.canViewAll || access.canAssign;
  return { workspace, access, callWhere: { workspaceId: workspace.id, ...(seesAll ? {} : { userId: access.userId }) } };
}

// A recording uploaded on the Calls page, already transcribed in the
// browser, lands in the inbox like a phone call would.
export async function addUploadedCall(input: { transcript: string; seconds: number }): Promise<void> {
  const { workspace, access } = await callScope();
  const transcript = typeof input.transcript === "string" ? input.transcript.trim() : "";
  if (!transcript) throw new Error("That recording has no transcript");
  if (transcript.length > MAX_CHARS) throw new Error("That recording is too long. Upload one call at a time");
  const seconds = Number.isFinite(input.seconds) && input.seconds > 0 ? Math.round(input.seconds) : null;

  await prisma.phoneCall.create({
    data: {
      workspaceId: workspace.id,
      userId: access.userId,
      source: "upload",
      status: "pending",
      transcript,
      durationSec: seconds,
      sttSeconds: seconds,
    },
  });
  revalidatePath("/calls");
}

// "Process": ties the call to a lead, then the work happens in the
// background (see runCallProcessing). Whether it was a cold or a sales call
// is SealMe's to work out unless the kind is passed ("Process anyway" keeps
// the one already worked out). Also retries a failed call.
export async function processCall(callId: string, input: { leadId: string; mode?: string; templateId?: string | null; force?: boolean }): Promise<void> {
  const { workspace, access, callWhere } = await callScope();
  if (!isExtractionConfigured()) throw new Error("Call processing isn't set up");
  const mode = input.mode === "cold" || input.mode === "sales" ? input.mode : "auto";

  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, workspaceId: workspace.id, AND: [access.where] }, select: { id: true, stage: true } });
  if (!lead) throw new Error("Pick a lead for this call");
  if (mode === "sales" && lead.stage === "converted") throw new Error("That lead is already a deal");

  let templateId: string | null = null;
  if (mode === "sales" && input.templateId) {
    const template = await prisma.contractTemplate.findFirst({ where: { id: input.templateId, workspaceId: workspace.id }, select: { id: true } });
    if (!template) throw new Error("That template isn't in this workspace");
    templateId = template.id;
  }

  const allowed = input.force ? ["pending", "failed", "skipped"] : ["pending", "failed"];
  const { count } = await prisma.phoneCall.updateMany({
    where: { ...callWhere, id: callId, status: { in: allowed } },
    data: { status: "processing", leadId: lead.id, mode, templateId },
  });
  if (count === 0) throw new Error("That call was already handled");

  const timeZone = await cookieTimeZone();
  after(() => runCallProcessing(callId, timeZone, { force: input.force }));
  revalidatePath("/calls");
}

// "Discard": nothing is processed, nothing is charged, and the transcript
// (or the phone recording at Telnyx) is gone.
export async function discardCall(callId: string): Promise<void> {
  const { callWhere } = await callScope();
  const call = await prisma.phoneCall.findFirst({ where: { ...callWhere, id: callId }, select: { telnyxRecordingId: true } });
  const { count } = await prisma.phoneCall.updateMany({
    where: { ...callWhere, id: callId, status: { in: ["pending", "failed"] } },
    data: { status: "discarded", transcript: null, summary: null, telnyxRecordingId: null },
  });
  if (count === 0) throw new Error("That call was already handled");
  if (call?.telnyxRecordingId) after(() => dropRecording(call.telnyxRecordingId, callId));
  revalidatePath("/calls");
}
