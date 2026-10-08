"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { mergeLeads } from "@/lib/lead-merge";
import { refreshLeadOverview } from "@/lib/lead-overview";
import { normalizePhone } from "@/lib/phone";
import { isValidDay } from "@/lib/tasks";
import { stageAfterOutcome } from "@/lib/cold-call";

export type LeadPick = { id: string; name: string; company: string | null; calls: number };

// Any lead the viewer can see, for "Move to another lead" and "Merge with":
// converted and lost ones too, since a client's earlier calls can be there.
export async function searchLeadsToJoin(excludeId: string, q: string): Promise<LeadPick[]> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const term = typeof q === "string" ? q.trim().slice(0, 100) : "";
  if (term.length < 2) return [];
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: workspace.id,
      id: { not: excludeId },
      AND: [access.where, { OR: [{ name: { contains: term, mode: "insensitive" } }, { company: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] }],
    },
    select: { id: true, name: true, company: true, _count: { select: { phoneCalls: { where: { status: "processed" } } } } },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return leads.map((l) => ({ id: l.id, name: l.name, company: l.company, calls: l._count.phoneCalls }));
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function heardOn(extracted: unknown): Record<string, unknown> {
  return (extracted && typeof extracted === "object" && !Array.isArray(extracted) ? extracted : {}) as Record<string, unknown>;
}

// After a call moves off or onto a lead, what the lead shows from its calls
// (last call, interest, next step) comes from its newest call again.
async function syncFromCalls(leadId: string) {
  const [latest, reached] = await Promise.all([
    prisma.phoneCall.findFirst({ where: { leadId, status: "processed" }, select: { summary: true }, orderBy: { startedAt: "desc" } }),
    prisma.phoneCall.findFirst({ where: { leadId, status: "processed", connected: true }, select: { startedAt: true, extracted: true }, orderBy: { startedAt: "desc" } }),
  ]);
  const heard = heardOn(reached?.extracted);
  const nextStep = text(heard.nextStep);
  const nextDay = text(heard.nextStepDate);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      summary: latest?.summary ?? null,
      lastContactedAt: reached?.startedAt ?? null,
      ...(reached
        ? {
            ...(["cold", "warm", "hot"].includes(String(heard.interest)) ? { interest: String(heard.interest) } : {}),
            ...(heard.isDecisionMaker === "yes" || heard.isDecisionMaker === "no" ? { isDecisionMaker: heard.isDecisionMaker === "yes" } : {}),
            nextStep,
            nextStepAt: nextStep && nextDay && isValidDay(nextDay) ? new Date(`${nextDay}T00:00:00Z`) : null,
          }
        : {}),
    },
  });
}

// "Move to another lead" on a call that landed on the wrong lead. To a lead
// on file, or "new" for a lead of its own filled in from the call. A lead
// made by a call that has no calls left is folded into where its call went.
export async function moveCallToLead(callId: string, targetLeadId: string): Promise<{ leadId: string }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const call = await prisma.phoneCall.findFirst({
    where: { id: callId, workspaceId: workspace.id, status: "processed", lead: access.where },
    select: { id: true, leadId: true, outcome: true, startedAt: true, processedAt: true, summary: true, extracted: true },
  });
  if (!call?.leadId) throw new Error("That call isn't available");
  const sourceId = call.leadId;

  let targetId: string;
  if (targetLeadId === "new") {
    const heard = heardOn(call.extracted);
    const email = text(heard.email)?.toLowerCase() ?? null;
    const created = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        ownerId: access.userId,
        name: (text(heard.contactName) ?? "Lead from a call").slice(0, 200),
        title: text(heard.title),
        company: text(heard.company),
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
        phone: normalizePhone(text(heard.phone)),
        painPoints: text(heard.painPoints),
        objections: text(heard.objections),
        stage: (call.outcome && stageAfterOutcome("new", call.outcome)) || "new",
        source: "call",
      },
      select: { id: true },
    });
    targetId = created.id;
  } else {
    const target = await prisma.lead.findFirst({ where: { id: targetLeadId, workspaceId: workspace.id, AND: [access.where] }, select: { id: true } });
    if (!target) throw new Error("That lead isn't available");
    if (target.id === sourceId) throw new Error("The call is already on that lead");
    targetId = target.id;
  }

  // Its "where things stand" was about the lead it's leaving.
  const heard = { ...heardOn(call.extracted) };
  delete heard.overview;
  delete heard.overviewCalls;
  await prisma.phoneCall.update({ where: { id: call.id }, data: { leadId: targetId, ...(call.extracted ? { extracted: heard as object } : {}) } });
  // The follow-up the call set up moves with it. Tasks carry no call id, but
  // the call's are saved in the same write as the call itself.
  if (call.processedAt) {
    const at = call.processedAt.getTime();
    await prisma.task.updateMany({
      where: { leadId: sourceId, status: "open", type: { in: ["follow_up", "sales_call"] }, createdAt: { gte: new Date(at - 2_000), lte: new Date(at + 30_000) } },
      data: { leadId: targetId },
    });
  }

  const source = await prisma.lead.findUnique({
    where: { id: sourceId },
    select: { source: true, _count: { select: { phoneCalls: { where: { status: "processed" } } } } },
  });
  const sourceGone = source?.source === "call" && source._count.phoneCalls === 0;
  if (sourceGone) await mergeLeads(workspace.id, sourceId, targetId);
  else await syncFromCalls(sourceId);
  await syncFromCalls(targetId);

  after(async () => {
    await refreshLeadOverview(targetId);
    if (!sourceGone) await refreshLeadOverview(sourceId);
  });
  revalidatePath(`/leads/${targetId}`);
  revalidatePath(`/leads/${sourceId}`);
  revalidatePath("/leads");
  return { leadId: targetId };
}

// "Merge with…" on a lead: this lead (and all its calls) goes into the one
// picked, which is where the viewer lands.
export async function mergeLeadInto(sourceId: string, targetId: string): Promise<{ leadId: string }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const both = await prisma.lead.findMany({ where: { id: { in: [sourceId, targetId] }, workspaceId: workspace.id, AND: [access.where] }, select: { id: true } });
  if (both.length !== 2) throw new Error("That lead isn't available");
  await mergeLeads(workspace.id, sourceId, targetId);
  after(() => refreshLeadOverview(targetId));
  revalidatePath(`/leads/${targetId}`);
  revalidatePath("/leads");
  return { leadId: targetId };
}
