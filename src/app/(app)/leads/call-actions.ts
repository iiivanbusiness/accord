"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { extractColdCall } from "@/lib/extract-cold-call";
import { UNREACHED_OUTCOMES } from "@/lib/call-outcomes";
import { normalizePhone } from "@/lib/phone";
import { isValidDay } from "@/lib/tasks";
import { cookieTimeZone, dayInZone } from "@/lib/viewer-time";

const MIN_WORDS = 15;
const MAX_CHARS = 100_000;
const STAGE_ORDER: Record<string, number> = { new: 0, contacted: 1, interested: 2, meeting: 3 };
const TARGET_STAGE: Record<string, string> = {
  meeting_booked: "meeting",
  interested: "interested",
  follow_up: "contacted",
  wrong_person: "contacted",
  not_interested: "lost",
};

export type ColdCallSummary = {
  outcome: string;
  stage: string | null; // the stage it moved to, if it moved
  closedTask: string | null; // the kind of task it marked done
  followUp: { type: string; date: string; time: string | null } | null;
  costUsd: number;
};

// "Add transcript" on a lead: Haiku reads a pasted cold-call transcript,
// the call is saved to the lead's history, the lead's fields and stage are
// updated, the rep's open call task on this lead is marked done, and an
// agreed next step becomes a task on its day.
export async function processColdCallTranscript(leadId: string, transcript: string): Promise<ColdCallSummary> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const text = typeof transcript === "string" ? transcript.trim() : "";
  if (text.split(/\s+/).length < MIN_WORDS) throw new Error("That's too short to be a call transcript");
  if (text.length > MAX_CHARS) throw new Error("That transcript is too long. Paste one call at a time");
  if (!isExtractionConfigured()) throw new Error("Call processing isn't set up");

  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, AND: [access.where] } });
  if (!lead) throw new Error("Lead not found");

  const tz = await cookieTimeZone();
  const today = dayInZone(new Date(), tz);
  const result = await extractColdCall(text, lead, today);
  const now = new Date();
  const reached = !UNREACHED_OUTCOMES.has(result.outcome);

  // Stage only moves forward (or to lost), and a converted lead stays put.
  let stage: string | null = null;
  const target = TARGET_STAGE[result.outcome];
  if (target && lead.stage !== "converted" && target !== lead.stage) {
    if (target === "lost" || lead.stage === "lost" || (STAGE_ORDER[target] ?? 0) > (STAGE_ORDER[lead.stage] ?? 0)) stage = target;
  }

  const email = result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) ? result.email.toLowerCase() : null;
  const nextStepAt = result.nextStepDate && isValidDay(result.nextStepDate) ? new Date(`${result.nextStepDate}T00:00:00Z`) : null;

  const closable = await prisma.task.findFirst({
    where: { leadId: lead.id, assigneeId: access.userId, status: "open", type: { in: ["cold_call", "follow_up"] } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, type: true },
  });

  // A meeting becomes a sales call on its day; anything else agreed for a
  // later day becomes a follow-up. Not when it's already on the list.
  let followUp: ColdCallSummary["followUp"] = null;
  if (nextStepAt && result.nextStepDate! > today && ["meeting_booked", "interested", "follow_up"].includes(result.outcome)) {
    const type = result.outcome === "meeting_booked" ? "sales_call" : "follow_up";
    const exists = await prisma.task.findFirst({ where: { leadId: lead.id, assigneeId: access.userId, status: "open", type, dueDate: nextStepAt }, select: { id: true } });
    if (!exists) followUp = { type, date: result.nextStepDate!, time: result.nextStepTime };
  }

  await prisma.$transaction([
    prisma.phoneCall.create({
      data: {
        workspaceId: workspace.id,
        userId: access.userId,
        leadId: lead.id,
        mode: "cold",
        status: "processed",
        source: "paste",
        outcome: result.outcome,
        connected: result.connected,
        toNumber: lead.phone,
        transcript: text,
        summary: result.summary || null,
        extracted: result.raw as object,
        aiInputTokens: result.usage.inputTokens,
        aiOutputTokens: result.usage.outputTokens,
        startedAt: now,
        processedAt: now,
      },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        summary: result.summary || lead.summary,
        ...(stage ? { stage } : {}),
        ...(reached
          ? {
              lastContactedAt: now,
              ...(result.interest ? { interest: result.interest } : {}),
              ...(result.isDecisionMaker !== null ? { isDecisionMaker: result.isDecisionMaker } : {}),
              ...(result.painPoints ? { painPoints: result.painPoints } : {}),
              ...(result.objections ? { objections: result.objections } : {}),
              ...(result.nextStep ? { nextStep: result.nextStep, nextStepAt } : {}),
              // Details someone typed in by hand are never overwritten.
              ...(!lead.title && result.title ? { title: result.title } : {}),
              ...(!lead.company && result.company ? { company: result.company } : {}),
              ...(!lead.email && email ? { email } : {}),
              ...(!lead.phone && normalizePhone(result.phone) ? { phone: normalizePhone(result.phone) } : {}),
            }
          : {}),
      },
    }),
    ...(closable ? [prisma.task.update({ where: { id: closable.id }, data: { status: "done", completedAt: now } })] : []),
    ...(followUp
      ? [
          prisma.task.create({
            data: {
              workspaceId: workspace.id,
              leadId: lead.id,
              assigneeId: access.userId,
              createdById: access.userId,
              type: followUp.type,
              dueDate: nextStepAt!,
              dueTime: followUp.time,
              timezone: tz,
              note: result.nextStep,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/leads");
  revalidatePath("/today");
  return { outcome: result.outcome, stage, closedTask: closable?.type ?? null, followUp, costUsd: result.usage.costUsd };
}
