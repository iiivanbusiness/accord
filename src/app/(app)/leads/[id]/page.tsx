import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_INTEREST_LABEL } from "@/lib/lead-stages";
import { formatPhone } from "@/lib/phone";
import LeadFields from "@/components/LeadFields";
import SubmitButton from "@/components/SubmitButton";
import LeadTasks from "@/components/LeadTasks";
import LeadCalls from "@/components/LeadCalls";
import { setLeadStage, updateLead } from "../actions";
import { createLeadTask, deleteTask, setTaskStatus } from "../task-actions";
import { processColdCallTranscript } from "../call-actions";

// Processing a pasted call transcript (an action on this page) waits on
// Claude; give it room beyond the default.
export const maxDuration = 60;

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const workspace = await requireProspecting();
  const { id } = await params;
  const { created, saved } = await searchParams;

  const access = await leadAccess();
  const [lead, members, tasks, calls] = await Promise.all([
    prisma.lead.findFirst({ where: { id, workspaceId: workspace.id, ...access.where }, include: { owner: { select: { id: true, name: true } } } }),
    access.canAssign
      ? prisma.user.findMany({ where: { workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    // Only used once the lead itself passed the visibility check below.
    prisma.task.findMany({
      where: { leadId: id, workspaceId: workspace.id },
      select: { id: true, type: true, dueDate: true, dueTime: true, priority: true, status: true, note: true, assigneeId: true, assignee: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "asc" }],
    }),
    prisma.phoneCall.findMany({
      where: { leadId: id, workspaceId: workspace.id, status: "processed" },
      select: { id: true, startedAt: true, outcome: true, summary: true, transcript: true, source: true, user: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);
  if (!lead) notFound();
  // A rep can't reassign, so the owner field just shows who has it.
  const owners = access.canAssign ? members : lead.owner ? [lead.owner] : [];

  const subtitle = [lead.title, lead.company].filter(Boolean).join(" · ");

  return (
    <>
      <Link href="/leads" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Leads
      </Link>

      {(created || saved) && (
        <div className="chip chip-success mb-4 w-full max-w-[640px] justify-start px-4 py-2.5 text-[12.5px]">
          {created ? "Lead added." : "Changes saved."}
        </div>
      )}

      <div className="mb-5 min-w-0">
        <h1 className="break-words text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>{lead.name}</h1>
        {subtitle && <div className="mt-1 break-words text-[13.5px]" style={{ color: "var(--ink-muted)" }}>{subtitle}</div>}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {lead.phone && <a href={`tel:${lead.phone}`} className="font-medium" style={{ color: "var(--accent-blue)" }}>{formatPhone(lead.phone)}</a>}
          {lead.email && <a href={`mailto:${lead.email}`} className="break-all font-medium" style={{ color: "var(--accent-blue)" }}>{lead.email}</a>}
          <span style={{ color: "var(--ink-muted)" }}>{lead.owner ? `Owner: ${lead.owner.name}` : "Unassigned"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <LeadCalls
          calls={calls.map((c) => ({ id: c.id, at: c.startedAt.toISOString(), who: c.user?.name ?? null, outcome: c.outcome, summary: c.summary, transcript: c.transcript, source: c.source }))}
          processAction={processColdCallTranscript.bind(null, lead.id)}
        />
        <form action={updateLead.bind(null, lead.id)} className="card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
          <div className="text-[14px] font-medium">Details</div>
          <LeadFields owners={owners} full values={lead} allowUnassigned={access.canAssign} />
          <SubmitButton className="btn btn-primary w-full justify-center sm:w-auto sm:self-start" pendingText="Saving…">
            Save changes
          </SubmitButton>
        </form>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <div className="card flex flex-col gap-3 p-5">
            <div className="text-[14px] font-medium">Stage</div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((stage) => {
                const active = lead.stage === stage;
                return (
                  <form key={stage} action={setLeadStage.bind(null, lead.id, stage)}>
                    <button
                      type="submit"
                      disabled={active}
                      aria-pressed={active}
                      className="btn btn-sm"
                      style={active ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
                    >
                      {LEAD_STAGE_LABEL[stage]}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <LeadTasks
            tasks={tasks.map(({ assignee, ...t }) => ({ ...t, dueDate: t.dueDate.toISOString(), assigneeName: assignee?.name ?? null }))}
            userId={access.userId}
            canAssign={access.canAssign}
            assignees={members}
            createAction={createLeadTask.bind(null, lead.id)}
            statusAction={setTaskStatus}
            deleteAction={deleteTask}
          />

          <div className="card flex flex-col gap-2.5 p-5 text-[13px]">
            <div className="text-[14px] font-medium">At a glance</div>
            <Row label="Interest" value={lead.interest ? LEAD_INTEREST_LABEL[lead.interest] : "Not known yet"} />
            <Row label="Decision maker" value={lead.isDecisionMaker === true ? "Yes" : lead.isDecisionMaker === false ? "No" : "Not known yet"} />
            <Row label="Next step" value={[lead.nextStepAt ? formatDay(lead.nextStepAt) : null, lead.nextStep].filter(Boolean).join(" · ") || "None"} />
            <Row label="Source" value={SOURCE_LABEL[lead.source] ?? lead.source} />
            {lead.summary && (
              <div className="mt-1 border-t pt-2.5" style={{ borderColor: "var(--hairline-soft)" }}>
                <div className="mb-1 text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>Last call</div>
                <div className="break-words">{lead.summary}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Added by hand",
  paste: "Pasted from a sheet",
  csv: "CSV import",
  xlsx: "Excel import",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  call: "From a call",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none" style={{ color: "var(--ink-muted)" }}>{label}</span>
      <span className="min-w-0 break-words text-right">{value}</span>
    </div>
  );
}
