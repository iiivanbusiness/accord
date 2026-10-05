"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { applyColdCall, type ColdCallSummary } from "@/lib/cold-call";
import { cookieTimeZone } from "@/lib/viewer-time";
import { pushCallToCrm } from "@/lib/crm-call-sync";

const MIN_WORDS = 15;
const MAX_CHARS = 100_000;

// "Add transcript" on a lead: the pasted cold-call transcript goes through
// the same processing as a call from the Calls inbox (see lib/cold-call.ts).
export async function processColdCallTranscript(leadId: string, transcript: string): Promise<ColdCallSummary> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const text = typeof transcript === "string" ? transcript.trim() : "";
  if (text.split(/\s+/).length < MIN_WORDS) throw new Error("That's too short to be a call transcript");
  if (text.length > MAX_CHARS) throw new Error("That transcript is too long. Paste one call at a time");
  if (!isExtractionConfigured()) throw new Error("Call processing isn't set up");

  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, AND: [access.where] } });
  if (!lead) throw new Error("Lead not found");

  const result = await applyColdCall({ workspaceId: workspace.id, userId: access.userId, lead, transcript: text, timeZone: await cookieTimeZone() });
  after(() => pushCallToCrm(result.callId));

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/leads");
  revalidatePath("/today");
  return result;
}
