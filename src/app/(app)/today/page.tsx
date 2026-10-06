import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { currentUserWithRole } from "@/lib/permissions";
import { cookieTimeZone, dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import { formatPhone } from "@/lib/phone";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/deal-status";
import { formatTaskDue, TASK_TYPE_LABEL } from "@/lib/tasks";
import TodayTaskRow, { type TodayTask } from "@/components/TodayTaskRow";
import LeadCallButton from "@/components/LeadCallButton";
import { CALL_OUTCOME_CHIP, CALL_OUTCOME_LABEL } from "@/lib/call-outcomes";
import TaskDigestToggle from "@/components/TaskDigestToggle";
import { setTaskStatus } from "../leads/task-actions";
import { startLeadCall } from "../leads/phone-actions";
import { setTaskDigestEmail } from "../preferences-actions";

const DAY = 24 * 60 * 60 * 1000;
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const CONTRACTS_SHOWN = 8;

type TaskRow = {
  id: string;
  type: string;
  status: string;
  dueDate: Date;
  dueTime: string | null;
  priority: string;
  note: string | null;
  lead: {
    id: string;
    name: string;
    company: string | null;
    title: string | null;
    phone: string | null;
    summary: string | null;
    objections: string | null;
    isDecisionMaker: boolean | null;
  } | null;
};

const byPriority = (a: TaskRow, b: TaskRow) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
// Timed tasks first, in time order; untimed ones after.
const byTime = (a: TaskRow, b: TaskRow) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");

function toRow(t: TaskRow, when: string): TodayTask {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    when,
    priority: t.priority,
    note: t.note,
    lead: t.lead
      ? {
          id: t.lead.id,
          name: t.lead.name,
          detail: [t.lead.title, t.lead.company].filter(Boolean).join(" · ") || formatPhone(t.lead.phone) || "",
          phone: t.lead.phone,
          phoneLabel: formatPhone(t.lead.phone),
        }
      : null,
  };
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export default async function TodayPage() {
  const workspace = await requireProspecting();
  const user = await currentUserWithRole();
  const tz = await cookieTimeZone();
  const now = new Date();
  const today = dayInZone(now, tz);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const tomorrowDate = new Date(todayDate.getTime() + DAY);
  const horizon = new Date(todayDate.getTime() + 8 * DAY);

  const taskSelect = {
    id: true,
    type: true,
    status: true,
    dueDate: true,
    dueTime: true,
    priority: true,
    note: true,
    lead: { select: { id: true, name: true, company: true, title: true, phone: true, summary: true, objections: true, isDecisionMaker: true } },
  } as const;

  const delegations = await prisma.approvalDelegate.findMany({
    where: { toUserId: user.id, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { fromUserId: true },
  });
  const reviewerIds = [user.id, ...delegations.map((d) => d.fromUserId)];

  const dayStart = startOfDayInZone(now, tz);
  const [open, finished, myDeals, pendingSteps, justSaved, callsToCheck, meetings] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId: workspace.id, assigneeId: user.id, status: "open", dueDate: { lt: horizon } },
      select: taskSelect,
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "asc" }],
      take: 1000,
    }),
    prisma.task.findMany({
      where: { workspaceId: workspace.id, assigneeId: user.id, status: { in: ["done", "skipped"] }, completedAt: { gte: startOfDayInZone(now, tz) } },
      select: taskSelect,
      orderBy: { completedAt: "desc" },
      take: 200,
    }),
    // Contracts this person has to move along: theirs to review and send,
    // and theirs out with the client for signature.
    prisma.deal.findMany({
      where: { workspaceId: workspace.id, ownerId: user.id, trashedAt: null, status: { in: ["ready", "missing_info", "changes_requested", "sent"] } },
      select: { id: true, status: true, service: true, client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.reviewStep.findMany({
      where: { status: "pending", assigneeId: { in: reviewerIds }, contract: { deal: { workspaceId: workspace.id, trashedAt: null } } },
      select: {
        id: true,
        contract: {
          select: {
            reviewSteps: { where: { status: "pending" }, orderBy: { order: "asc" }, take: 1, select: { id: true } },
            deal: { select: { id: true, service: true, client: { select: { name: true } } } },
          },
        },
      },
      take: 40,
    }),
    // The call SealMe just wrote up, so the rep sees what went on the lead.
    prisma.phoneCall.findFirst({
      where: { workspaceId: workspace.id, userId: user.id, status: "processed", processedAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
      orderBy: { processedAt: "desc" },
      select: { id: true, mode: true, outcome: true, summary: true, dealId: true, lead: { select: { id: true, name: true } } },
    }),
    prisma.phoneCall.count({ where: { workspaceId: workspace.id, userId: user.id, status: { in: ["pending", "failed"] } } }),
    prisma.calendarEvent.findMany({
      where: { workspaceId: workspace.id, startTime: { gte: new Date(Math.max(now.getTime() - 60 * 60 * 1000, dayStart.getTime())), lt: new Date(dayStart.getTime() + DAY) } },
      orderBy: { startTime: "asc" },
      select: { id: true, title: true, startTime: true },
      take: 3,
    }),
  ]);

  const overdue = open.filter((t) => t.dueDate < todayDate).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || byPriority(a, b));
  const dueToday = open.filter((t) => t.dueDate.getTime() === todayDate.getTime());
  const coldCalls = dueToday.filter((t) => t.type === "cold_call").sort((a, b) => byPriority(a, b) || byTime(a, b));
  const salesCalls = dueToday.filter((t) => t.type === "sales_call").sort(byTime);
  const followUps = dueToday.filter((t) => t.type !== "cold_call" && t.type !== "sales_call").sort((a, b) => byTime(a, b) || byPriority(a, b));
  const upcoming = open.filter((t) => t.dueDate >= tomorrowDate);

  // Next up: anything overdue, then what's due within half an hour, then
  // today's untimed tasks by priority, then the rest of today in time order.
  const clock = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
  const soon = clock(new Date(now.getTime() + 30 * 60 * 1000));
  const next =
    [
      ...overdue,
      ...dueToday.filter((t) => t.dueTime && t.dueTime <= soon).sort(byTime),
      ...dueToday.filter((t) => !t.dueTime).sort(byPriority),
      ...dueToday.filter((t) => t.dueTime && t.dueTime > soon).sort(byTime),
    ][0] ?? null;
  const notNext = (t: TaskRow) => t.id !== next?.id;

  // Only the step that's actually up: later steps in a chain wait their turn.
  const approvals = pendingSteps.filter((s) => s.contract.reviewSteps[0]?.id === s.id).map((s) => s.contract.deal);
  const needsYou = myDeals.filter((d) => d.status !== "sent");
  const awaitingSignature = myDeals.filter((d) => d.status === "sent");
  // Approvals first: someone else is waiting on those.
  const contractItems = [
    ...approvals.map((d) => ({ ...d, label: "Waiting for your approval", chip: "chip-warn" })),
    ...needsYou.map((d) => ({ ...d, label: STATUS_LABEL[d.status] ?? d.status, chip: STATUS_CHIP[d.status] ?? "chip-neutral" })),
    ...awaitingSignature.map((d) => ({ ...d, label: "Waiting for signature", chip: "chip-neutral" })),
  ];
  const contractCount = contractItems.length;

  const left = overdue.length + dueToday.length;
  const done = finished.length;
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(now);

  // Coming up: one line per day, counted by kind.
  const upcomingDays = new Map<string, TaskRow[]>();
  for (const t of upcoming) {
    const key = t.dueDate.toISOString().slice(0, 10);
    upcomingDays.set(key, [...(upcomingDays.get(key) ?? []), t]);
  }

  const rows = (tasks: TaskRow[], when: (t: TaskRow) => string, opts: { overdue?: boolean; showType?: boolean } = {}) =>
    tasks.map((t, i) => (
      <div key={t.id} style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
        <TodayTaskRow task={toRow(t, when(t))} overdue={opts.overdue} showType={opts.showType} statusAction={setTaskStatus} callAction={startLeadCall} />
      </div>
    ));

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Today</h1>
          <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
            {dateLabel} · {left === 0 && done === 0 ? "no tasks due" : `${done.toLocaleString("en-US")} finished, ${left.toLocaleString("en-US")} to go`}
          </div>
        </div>
        <Link href="/leads" className="btn btn-secondary">
          All leads
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {next && <NextUp task={next} overdue={next.dueDate < todayDate} />}

        {justSaved?.lead && (
          <div className="card flex flex-col gap-2 px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: "var(--ink-muted)", letterSpacing: "0.4px" }}>JUST SAVED</span>
              {justSaved.mode === "sales" ? (
                <span className="chip chip-success">Deal created</span>
              ) : (
                justSaved.outcome && <span className={`chip ${CALL_OUTCOME_CHIP[justSaved.outcome] ?? "chip-neutral"}`}>{CALL_OUTCOME_LABEL[justSaved.outcome] ?? justSaved.outcome}</span>
              )}
            </div>
            <div className="text-[14px] font-medium">Your call with {justSaved.lead.name}</div>
            {justSaved.summary && <div className="line-clamp-3 break-words text-[13px]" style={{ color: "var(--ink-muted)" }}>{justSaved.summary}</div>}
            <Link href={justSaved.mode === "sales" && justSaved.dealId ? `/deals/${justSaved.dealId}` : `/leads/${justSaved.lead.id}`} className="w-fit text-[13px] font-medium" style={{ color: "var(--accent-blue)" }}>
              {justSaved.mode === "sales" ? "Check the deal →" : "Check or fix the notes →"}
            </Link>
          </div>
        )}

        {(callsToCheck > 0 || meetings.length > 0 || contractCount > 0) && (
          <Section title="Waiting on you" count={callsToCheck + meetings.length + contractCount}>
            {callsToCheck > 0 && (
              <WaitingRow href="/calls" title={callsToCheck === 1 ? "1 call needs a look" : `${callsToCheck} calls need a look`} detail="Pick who it was with, or try again" />
            )}
            {meetings.map((m) => (
              <WaitingRow
                key={m.id}
                href="/calendar"
                title={`Meeting at ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(m.startTime)}`}
                detail={m.title}
              />
            ))}
            {contractItems.slice(0, CONTRACTS_SHOWN).map((d, i) => (
              <WaitingRow key={`${d.id}-${i}`} href={`/deals/${d.id}`} title={d.client.name} detail={d.service} chip={{ label: d.label, cls: d.chip }} />
            ))}
            {contractCount > CONTRACTS_SHOWN && (
              <Link href="/deals" className="block px-4 py-3 text-[13px] font-medium sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)", color: "var(--accent-blue)" }}>
                {plural(contractCount - CONTRACTS_SHOWN, "more contract", "more contracts")} in Deals
              </Link>
            )}
          </Section>
        )}

        {overdue.filter(notNext).length > 0 && (
          <Section title="Overdue" count={overdue.filter(notNext).length} tone="warn">
            {rows(overdue.filter(notNext), (t) => formatTaskDue(t.dueDate, t.dueTime), { overdue: true, showType: true })}
          </Section>
        )}

        {coldCalls.filter(notNext).length > 0 && (
          <Section title="Cold calls" count={coldCalls.filter(notNext).length}>
            {rows(coldCalls.filter(notNext), (t) => t.dueTime ?? "")}
          </Section>
        )}

        {salesCalls.filter(notNext).length > 0 && (
          <Section title="Sales calls" count={salesCalls.filter(notNext).length}>
            {rows(salesCalls.filter(notNext), (t) => t.dueTime ?? "Any time")}
          </Section>
        )}

        {followUps.filter(notNext).length > 0 && (
          <Section title="Follow-ups and other" count={followUps.filter(notNext).length}>
            {rows(followUps.filter(notNext), (t) => t.dueTime ?? "", { showType: true })}
          </Section>
        )}

        {!next && contractCount === 0 && callsToCheck === 0 && (
          <div className="card flex flex-col items-start gap-2 p-6">
            <div className="text-[14.5px] font-medium">{done > 0 ? "All done for today" : "Nothing due today"}</div>
            <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              {upcoming.length > 0 ? "Your next tasks are below." : "Calls and follow-ups assigned to you will show up here on the day they're due."}
            </div>
          </div>
        )}

        {upcomingDays.size > 0 && (
          <Section title="Coming up" count={upcoming.length}>
            {[...upcomingDays.entries()].map(([day, tasks], i) => {
              const kinds = new Map<string, number>();
              for (const t of tasks) kinds.set(t.type, (kinds.get(t.type) ?? 0) + 1);
              const label = day === tomorrowDate.toISOString().slice(0, 10) ? "Tomorrow" : formatTaskDue(new Date(`${day}T00:00:00Z`), null);
              return (
                <div key={day} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[13px] sm:px-5" style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
                  <span className="font-medium">{label}</span>
                  <span style={{ color: "var(--ink-muted)" }}>
                    {[...kinds.entries()].map(([type, n]) => plural(n, (TASK_TYPE_LABEL[type] ?? type).toLowerCase(), `${(TASK_TYPE_LABEL[type] ?? type).toLowerCase()}s`)).join(", ")}
                  </span>
                </div>
              );
            })}
          </Section>
        )}

        {finished.length > 0 && (
          <details className="card overflow-hidden">
            <summary className="flex cursor-pointer select-none items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="text-[14px] font-medium">Finished today</span>
              <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{finished.length}</span>
            </summary>
            <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>{rows(finished, () => "", { showType: true })}</div>
          </details>
        )}

        <div className="px-1 pt-1">
          <TaskDigestToggle enabled={user.taskDigestEmail} action={setTaskDigestEmail} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, tone, className, children }: { title: string; count: number; tone?: "warn"; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card overflow-hidden ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--hairline-soft)" }}>
        <h2 className="text-[14px] font-medium" style={tone === "warn" ? { color: "var(--warn)" } : undefined}>{title}</h2>
        <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{count.toLocaleString("en-US")}</span>
      </div>
      <div>{children}</div>
    </section>
  );
}

// The one thing to do now: who to call, what you know about them, and the
// button that starts the call. Done and Skip move on to the next.
function NextUp({ task, overdue }: { task: TaskRow; overdue: boolean }) {
  const lead = task.lead;
  const isCall = task.type === "cold_call" || task.type === "sales_call";
  const title = lead ? (isCall ? `Call ${lead.name}` : task.type === "follow_up" ? `Follow up with ${lead.name}` : `${TASK_TYPE_LABEL[task.type] ?? "Task"}: ${lead.name}`) : (TASK_TYPE_LABEL[task.type] ?? "Task");
  const detail = [lead?.company, TASK_TYPE_LABEL[task.type] ?? task.type, overdue ? `was due ${formatTaskDue(task.dueDate, task.dueTime)}` : task.dueTime ? `due ${task.dueTime}` : "today"]
    .filter(Boolean)
    .join(" · ");
  const facts = [
    lead?.isDecisionMaker === true ? "Decision maker" : lead?.isDecisionMaker === false ? "Not the decision maker" : null,
    lead?.objections ? `Worried about: ${lead.objections}` : null,
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] p-5" style={{ background: "var(--surface-inverted)", color: "var(--on-surface-inverted)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold" style={{ letterSpacing: "1px", color: "var(--on-surface-inverted-muted)" }}>NEXT UP</span>
        {overdue && <span className="chip chip-warn">Overdue</span>}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="break-words text-[21px] font-semibold" style={{ letterSpacing: "-0.4px" }}>{title}</h2>
        <div className="text-[13.5px]" style={{ color: "var(--on-surface-inverted-muted)" }}>{detail}</div>
      </div>
      {(task.note || lead?.summary || facts.length > 0) && (
        <div className="flex flex-col gap-1 rounded-[12px] px-3 py-2.5 text-[13px] leading-relaxed" style={{ background: "var(--surface-inverted-2)" }}>
          {task.note && <div className="break-words">{task.note}</div>}
          {lead?.summary && <div className="line-clamp-3 break-words">Last call: {lead.summary}</div>}
          {facts.length > 0 && <div style={{ color: "var(--on-surface-inverted-muted)" }}>{facts.join(" · ")}</div>}
        </div>
      )}
      {lead?.phone && isCall ? (
        <LeadCallButton variant="hero" leadName={lead.name} startAction={startLeadCall.bind(null, lead.id)} />
      ) : lead ? (
        <Link href={`/leads/${lead.id}`} className="btn w-full justify-center" style={{ height: 50, fontSize: 16, background: "var(--on-surface-inverted)", color: "var(--surface-inverted)" }}>
          Open {lead.name}
        </Link>
      ) : null}
      <div className="flex justify-center gap-7 text-[13px]">
        <form action={setTaskStatus.bind(null, task.id, "done")}>
          <button type="submit" className="px-1 py-1 font-medium" style={{ color: "var(--on-surface-inverted)" }}>Done</button>
        </form>
        <form action={setTaskStatus.bind(null, task.id, "skipped")}>
          <button type="submit" className="px-1 py-1" style={{ color: "var(--on-surface-inverted-muted)" }}>Skip</button>
        </form>
      </div>
    </section>
  );
}

function WaitingRow({ href, title, detail, chip }: { href: string; title: string; detail?: string | null; chip?: { label: string; cls: string } }) {
  return (
    <Link href={href} className="row-hover flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)", marginTop: -1 }}>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{title}</div>
        {detail && <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{detail}</div>}
      </div>
      {chip ? <span className={`chip flex-none whitespace-nowrap ${chip.cls}`}>{chip.label}</span> : <span aria-hidden style={{ color: "var(--ink-muted)" }}>›</span>}
    </Link>
  );
}
