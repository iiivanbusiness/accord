"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { runCallProcessing } from "@/lib/call-inbox";
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

// "Process": ties the call to a lead and a kind, then the work happens in
// the background (see runCallProcessing). Also retries a failed call, and
// "Process anyway" on one that was set aside.
export async function processCall(callId: string, input: { leadId: string; mode: string; force?: boolean }): Promise<void> {
  const { workspace, access, callWhere } = await callScope();
  if (!isExtractionConfigured()) throw new Error("Call processing isn't set up");
  if (input.mode !== "cold") throw new Error("Only cold calls can be processed for now");

  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, workspaceId: workspace.id, AND: [access.where] }, select: { id: true } });
  if (!lead) throw new Error("Pick a lead for this call");

  const allowed = input.force ? ["pending", "failed", "skipped"] : ["pending", "failed"];
  const { count } = await prisma.phoneCall.updateMany({
    where: { ...callWhere, id: callId, status: { in: allowed } },
    data: { status: "processing", leadId: lead.id, mode: input.mode },
  });
  if (count === 0) throw new Error("That call was already handled");

  const timeZone = await cookieTimeZone();
  after(() => runCallProcessing(callId, timeZone, { force: input.force }));
  revalidatePath("/calls");
}

// "Discard": nothing is processed, nothing is charged, and the transcript
// is gone.
export async function discardCall(callId: string): Promise<void> {
  const { callWhere } = await callScope();
  const { count } = await prisma.phoneCall.updateMany({
    where: { ...callWhere, id: callId, status: { in: ["pending", "failed"] } },
    data: { status: "discarded", transcript: null, summary: null },
  });
  if (count === 0) throw new Error("That call was already handled");
  revalidatePath("/calls");
}
