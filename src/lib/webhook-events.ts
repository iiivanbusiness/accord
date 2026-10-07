import { prisma } from "@/lib/db";
import { dispatchWebhookEvents, leadWebhookData } from "@/lib/webhooks";

// The prospecting events: a lead changed, a call is done, a meeting got
// booked, a task got done. Each one only loads what it needs when an
// endpoint is listening (see dispatchWebhookEvents), and none of them ever
// throws into the action that caused it.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const person = (u: { name: string; email: string } | null | undefined) => (u ? { name: u.name, email: u.email } : null);

// The lead fields lead.updated reports, by the name a receiver knows them
// by. summary and lastContactedAt change on every call; call.completed
// covers those.
const TRACKED_LEAD_FIELDS: Record<string, string> = {
  name: "name",
  company: "company",
  title: "title",
  email: "email",
  phone: "phone",
  domain: "domain",
  stage: "stage",
  interest: "interest",
  isDecisionMaker: "isDecisionMaker",
  painPoints: "painPoints",
  objections: "objections",
  nextStep: "nextStep",
  nextStepAt: "nextStepAt",
  notes: "notes",
  ownerId: "owner",
  externalId: "externalId",
};

export type LeadChange = { leadId: string; changed: string[]; previousStage: string | null };

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) return (a instanceof Date ? a.getTime() : null) === (b instanceof Date ? b.getTime() : null);
  return (a ?? null) === (b ?? null);
}

// What an update actually changes on a lead: before is the lead as it was,
// data what's being written. Keys that aren't written, or are written with
// the value they already had, don't count.
export function leadChanges(leadId: string, before: Record<string, unknown>, data: Record<string, unknown>): LeadChange {
  const changed = Object.keys(data)
    .filter((k) => k in TRACKED_LEAD_FIELDS && data[k] !== undefined && !same(before[k], data[k]))
    .map((k) => TRACKED_LEAD_FIELDS[k]);
  return { leadId, changed, previousStage: changed.includes("stage") ? ((before.stage as string | undefined) ?? null) : null };
}

// lead.updated: the lead as it is now, which fields changed and, when the
// stage moved, where it came from.
export async function dispatchLeadsUpdated(workspaceId: string, changes: LeadChange[]): Promise<void> {
  const real = changes.filter((c) => c.changed.length > 0);
  if (real.length === 0) return;
  await dispatchWebhookEvents(workspaceId, "lead.updated", async () => {
    const byId = new Map(real.map((c) => [c.leadId, c]));
    const rows = await leadWebhookData(workspaceId, [...byId.keys()]);
    const updatedAt = new Date().toISOString();
    return rows.map((r) => {
      const c = byId.get(r.leadId as string)!;
      return { ...r, changed: c.changed, previousStage: c.previousStage, updatedAt };
    });
  });
}

// Why a call was set aside, as call-inbox and telnyx-calls record it.
function skipReason(extracted: unknown): string | null {
  const v = extracted && typeof extracted === "object" ? (extracted as { skipped?: unknown }).skipped : null;
  return typeof v === "string" ? v : null;
}

// call.completed: SealMe is done with a call. Either its notes are written
// (status processed, with the outcome) or it was set aside (status
// skipped: nobody picked up, too short, nothing recorded...). A call that's
// processed again later fires again with the same callId.
export async function dispatchCallCompleted(workspaceId: string, callId: string): Promise<void> {
  await dispatchWebhookEvents(workspaceId, "call.completed", async () => {
    const c = await prisma.phoneCall.findFirst({
      where: { id: callId, workspaceId },
      select: {
        id: true,
        leadId: true,
        dealId: true,
        status: true,
        mode: true,
        source: true,
        outcome: true,
        connected: true,
        recorded: true,
        toNumber: true,
        durationSec: true,
        summary: true,
        extracted: true,
        startedAt: true,
        endedAt: true,
        processedAt: true,
        lead: { select: { name: true, company: true, externalId: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!c || (c.status !== "processed" && c.status !== "skipped")) return [];
    return [
      {
        callId: c.id,
        leadId: c.leadId,
        externalId: c.lead?.externalId ?? null,
        leadName: c.lead?.name ?? null,
        company: c.lead?.company ?? null,
        dealId: c.dealId,
        status: c.status,
        kind: c.mode === "cold" || c.mode === "sales" ? c.mode : null,
        outcome: c.outcome,
        connected: c.connected,
        skipReason: c.status === "skipped" ? skipReason(c.extracted) : null,
        summary: c.summary,
        source: c.source,
        toNumber: c.toNumber,
        recorded: c.recorded,
        durationSec: c.durationSec,
        rep: person(c.user),
        startedAt: iso(c.startedAt),
        endedAt: iso(c.endedAt),
        completedAt: iso(c.processedAt) ?? new Date().toISOString(),
      },
    ];
  });
}

export type BookedMeeting = {
  leadId: string;
  repId: string | null; // who has the meeting
  date: string | null; // YYYY-MM-DD in timeZone, when it's known
  time: string | null; // HH:mm
  timeZone: string;
  source: "call" | "manual";
  callId?: string | null;
  taskId?: string | null; // the sales call task it put on the rep's day
};

// meeting.booked: a cold call ended with a meeting, or someone put a sales
// call with a lead on a rep's day by hand.
export async function dispatchMeetingsBooked(workspaceId: string, meetings: BookedMeeting[]): Promise<void> {
  if (meetings.length === 0) return;
  await dispatchWebhookEvents(workspaceId, "meeting.booked", async () => {
    const [leads, reps] = await Promise.all([
      prisma.lead.findMany({
        where: { workspaceId, id: { in: [...new Set(meetings.map((m) => m.leadId))] } },
        select: { id: true, externalId: true, name: true, company: true, title: true, email: true, phone: true },
      }),
      prisma.user.findMany({ where: { workspaceId, id: { in: [...new Set(meetings.map((m) => m.repId).filter((id): id is string => Boolean(id)))] } }, select: { id: true, name: true, email: true } }),
    ]);
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const repById = new Map(reps.map((r) => [r.id, r]));
    const bookedAt = new Date().toISOString();
    return meetings.flatMap((m) => {
      const lead = leadById.get(m.leadId);
      if (!lead) return [];
      return [
        {
          leadId: lead.id,
          externalId: lead.externalId,
          leadName: lead.name,
          company: lead.company,
          title: lead.title,
          email: lead.email,
          phone: lead.phone,
          date: m.date,
          time: m.time,
          timeZone: m.timeZone,
          rep: person(m.repId ? repById.get(m.repId) : null),
          source: m.source,
          callId: m.callId ?? null,
          taskId: m.taskId ?? null,
          bookedAt,
        },
      ];
    });
  });
}

// task.completed: a task was marked done or skipped, by hand (completedBy)
// or because a processed call covered it (callId).
export async function dispatchTasksCompleted(workspaceId: string, taskIds: string[], by: { callId?: string | null; userId?: string | null } = {}): Promise<void> {
  if (taskIds.length === 0) return;
  await dispatchWebhookEvents(workspaceId, "task.completed", async () => {
    const [tasks, user] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId, id: { in: taskIds }, status: { in: ["done", "skipped"] } },
        select: {
          id: true,
          type: true,
          status: true,
          leadId: true,
          dealId: true,
          dueDate: true,
          dueTime: true,
          timezone: true,
          priority: true,
          note: true,
          completedAt: true,
          lead: { select: { name: true, externalId: true } },
          assignee: { select: { name: true, email: true } },
        },
      }),
      by.userId ? prisma.user.findUnique({ where: { id: by.userId }, select: { name: true, email: true } }) : null,
    ]);
    return tasks.map((t) => ({
      taskId: t.id,
      type: t.type,
      status: t.status,
      leadId: t.leadId,
      externalId: t.lead?.externalId ?? null,
      leadName: t.lead?.name ?? null,
      dealId: t.dealId,
      assignee: person(t.assignee),
      dueDate: day(t.dueDate),
      dueTime: t.dueTime,
      timeZone: t.timezone,
      priority: t.priority,
      note: t.note,
      callId: by.callId ?? null,
      completedBy: person(user),
      completedAt: iso(t.completedAt) ?? new Date().toISOString(),
    }));
  });
}
