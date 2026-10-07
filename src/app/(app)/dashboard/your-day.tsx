import Link from "next/link";
import { prisma } from "@/lib/db";
import { dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import { formatPhone } from "@/lib/phone";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/deal-status";
import { formatTaskDue, TASK_TYPE_LABEL } from "@/lib/tasks";
import TodayTaskRow, { type TodayTask } from "@/components/TodayTaskRow";
import LeadCallButton from "@/components/LeadCallButton";
import type { DashboardLine } from "@/components/DashboardLines";
import type { LineId } from "@/lib/dashboard-lines";
import { CALL_OUTCOME_CHIP, CALL_OUTCOME_LABEL } from "@/lib/call-outcomes";
import { isTelnyxConfigured } from "@/lib/telnyx";
import { setTaskStatus } from "@/app/(app)/leads/task-actions";
import { startLeadCall } from "@/app/(app)/leads/phone-actions";

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
    campaign: string | null;
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
          detail: [t.lead.campaign, t.lead.title, t.lead.company].filter(Boolean).join(" · ") || formatPhone(t.lead.phone) || "",
          phone: t.lead.phone,
          phoneLabel: formatPhone(t.lead.phone),
        }
      : null,
  };
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

function taskTitle(task: TaskRow) {
  const lead = task.lead;
  if (!lead) return TASK_TYPE_LABEL[task.type] ?? "Task";
  if (task.type === "cold_call" || task.type === "sales_call") return `Call ${lead.name}`;
  if (task.type === "follow_up") return `Follow up with ${lead.name}`;
  return `${TASK_TYPE_LABEL[task.type] ?? "Task"}: ${lead.name}`;
}

const muted = (text: React.ReactNode) => (
  <div className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--ink-muted)" }}>{text}</div>
);

// The person's own day as Dashboard lines: the one thing to do next, the
// rest of today's tasks, what's waiting on them and the calls SealMe just
// wrote up. Also the header's progress and the phone setup nudge.
export async function myDayLines({ workspaceId, userId, tz, need }: { workspaceId: string; userId: string; tz: string; need: Set<LineId> }) {
  const now = new Date();
  const today = dayInZone(now, tz);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const tomorrowDate = new Date(todayDate.getTime() + DAY);
  const horizon = new Date(todayDate.getTime() + 8 * DAY);
  const dayStart = startOfDayInZone(now, tz);

  const taskSelect = {
    id: true,
    type: true,
    status: true,
    dueDate: true,
    dueTime: true,
    priority: true,
    note: true,
    lead: { select: { id: true, name: true, company: true, campaign: true, title: true, phone: true, summary: true, objections: true, isDecisionMaker: true } },
  } as const;

  const wantWaiting = need.has("waiting");
  const delegations = wantWaiting
    ? await prisma.approvalDelegate.findMany({
        where: { toUserId: userId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        select: { fromUserId: true },
      })
    : [];
  const reviewerIds = [userId, ...delegations.map((d) => d.fromUserId)];

  const [me, open, finished, myDeals, pendingSteps, callsToCheck, savedCalls] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } }),
    prisma.task.findMany({
      where: { workspaceId, assigneeId: userId, status: "open", dueDate: { lt: horizon } },
      select: taskSelect,
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "asc" }],
      take: 1000,
    }),
    prisma.task.findMany({
      where: { workspaceId, assigneeId: userId, status: { in: ["done", "skipped"] }, completedAt: { gte: dayStart } },
      select: taskSelect,
      orderBy: { completedAt: "desc" },
      take: 200,
    }),
    // Contracts this person has to move along: theirs to review and send,
    // and theirs out with the client for signature.
    wantWaiting
      ? prisma.deal.findMany({
          where: { workspaceId, ownerId: userId, trashedAt: null, status: { in: ["ready", "missing_info", "changes_requested", "sent"] } },
          select: { id: true, status: true, service: true, client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 40,
        })
      : [],
    wantWaiting
      ? prisma.reviewStep.findMany({
          where: { status: "pending", assigneeId: { in: reviewerIds }, contract: { deal: { workspaceId, trashedAt: null } } },
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
        })
      : [],
    wantWaiting ? prisma.phoneCall.count({ where: { workspaceId, userId, status: { in: ["pending", "failed"] } } }) : 0,
    // Calls SealMe wrote up today, so the rep sees what went on the lead.
    need.has("saved")
      ? prisma.phoneCall.findMany({
          where: { workspaceId, userId, status: "processed", processedAt: { gte: dayStart } },
          orderBy: { processedAt: "desc" },
          select: { id: true, mode: true, outcome: true, summary: true, dealId: true, processedAt: true, lead: { select: { id: true, name: true } } },
          take: 5,
        })
      : [],
  ]);

  const overdue = open.filter((t) => t.dueDate < todayDate).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || byPriority(a, b));
  const dueToday = open.filter((t) => t.dueDate.getTime() === todayDate.getTime());
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
  const nextOverdue = Boolean(next && next.dueDate < todayDate);

  const left = overdue.length + dueToday.length;
  const done = finished.length;
  const progress = left === 0 && done === 0 ? "no tasks due" : `${done.toLocaleString("en-US")} finished, ${left.toLocaleString("en-US")} to go`;
  const lines: DashboardLine[] = [];

  if (need.has("next")) {
    lines.push({
      id: "next",
      tone: next ? (nextOverdue ? "urgent" : "due") : "quiet",
      summary: next
        ? `${taskTitle(next)} · ${nextOverdue ? `was due ${formatTaskDue(next.dueDate, next.dueTime)}` : next.dueTime ? `due ${next.dueTime}` : "today"}`
        : "Nothing due right now",
      body: next ? (
        <div className="p-3 sm:p-4">
          <NextUp task={next} overdue={nextOverdue} />
        </div>
      ) : (
        muted(
          <>
            Calls and follow-ups assigned to you show up here on the day they&apos;re due.{" "}
            <Link href="/leads" className="font-medium" style={{ color: "var(--accent-blue)" }}>All leads</Link>
          </>,
        )
      ),
    });
  }

  if (need.has("today")) {
    const rest = { overdue: overdue.filter(notNext), today: dueToday.filter(notNext) };
    const coldCalls = rest.today.filter((t) => t.type === "cold_call").sort((a, b) => byPriority(a, b) || byTime(a, b));
    const salesCalls = rest.today.filter((t) => t.type === "sales_call").sort(byTime);
    const followUps = rest.today.filter((t) => t.type !== "cold_call" && t.type !== "sales_call").sort((a, b) => byTime(a, b) || byPriority(a, b));
    const nextTimed = dueToday.filter((t) => t.dueTime && t.dueTime > clock(now)).sort(byTime)[0];

    // Coming up: one line per day, counted by kind.
    const upcomingDays = new Map<string, TaskRow[]>();
    for (const t of upcoming) {
      const key = t.dueDate.toISOString().slice(0, 10);
      upcomingDays.set(key, [...(upcomingDays.get(key) ?? []), t]);
    }

    const rows = (tasks: TaskRow[], when: (t: TaskRow) => string, opts: { overdue?: boolean; showType?: boolean } = {}) =>
      tasks.map((t) => (
        <div key={t.id} style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <TodayTaskRow task={toRow(t, when(t))} overdue={opts.overdue} showType={opts.showType} statusAction={setTaskStatus} callAction={startLeadCall} />
        </div>
      ));
    const group = (title: string, count: number, children: React.ReactNode, warn = false) => (
      <div key={title}>
        <div className="flex items-baseline justify-between gap-3 px-4 pb-1.5 pt-3 sm:px-5">
          <span className="text-[11.5px] font-semibold uppercase" style={{ letterSpacing: "0.6px", color: warn ? "var(--tone-urgent)" : "var(--ink-muted)" }}>{title}</span>
          <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-muted)" }}>{count.toLocaleString("en-US")}</span>
        </div>
        {children}
      </div>
    );

    const groups = [
      rest.overdue.length > 0 && group("Overdue", rest.overdue.length, rows(rest.overdue, (t) => formatTaskDue(t.dueDate, t.dueTime), { overdue: true, showType: true }), true),
      coldCalls.length > 0 && group("Cold calls", coldCalls.length, rows(coldCalls, (t) => t.dueTime ?? "")),
      salesCalls.length > 0 && group("Sales calls", salesCalls.length, rows(salesCalls, (t) => t.dueTime ?? "Any time")),
      followUps.length > 0 && group("Follow-ups and other", followUps.length, rows(followUps, (t) => t.dueTime ?? "", { showType: true })),
      upcomingDays.size > 0 &&
        group(
          "Coming up",
          upcoming.length,
          [...upcomingDays.entries()].map(([day, tasks]) => {
            const kinds = new Map<string, number>();
            for (const t of tasks) kinds.set(t.type, (kinds.get(t.type) ?? 0) + 1);
            const label = day === tomorrowDate.toISOString().slice(0, 10) ? "Tomorrow" : formatTaskDue(new Date(`${day}T00:00:00Z`), null);
            return (
              <div key={day} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[13px] sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
                <span className="font-medium">{label}</span>
                <span style={{ color: "var(--ink-muted)" }}>
                  {[...kinds.entries()].map(([type, n]) => plural(n, (TASK_TYPE_LABEL[type] ?? type).toLowerCase(), `${(TASK_TYPE_LABEL[type] ?? type).toLowerCase()}s`)).join(", ")}
                </span>
              </div>
            );
          }),
        ),
      finished.length > 0 && group("Finished today", finished.length, rows(finished, () => "", { showType: true })),
    ].filter(Boolean);

    const parts = [
      overdue.length > 0 && `${overdue.length.toLocaleString("en-US")} overdue`,
      dueToday.length > 0 && `${dueToday.length.toLocaleString("en-US")} due today`,
      nextTimed?.dueTime && `next at ${nextTimed.dueTime}`,
    ].filter(Boolean);
    lines.push({
      id: "today",
      // Red only for overdue work beyond Next up, which is already red.
      tone: rest.overdue.length ? "urgent" : left ? "due" : done ? "good" : "quiet",
      summary: parts.length
        ? parts.join(" · ")
        : done
          ? `All done · ${plural(done, "task", "tasks")} finished`
          : upcoming.length
            ? `Nothing today · ${upcoming.length.toLocaleString("en-US")} coming up`
            : "Nothing due today",
      meta: left + done > 0 ? `${done.toLocaleString("en-US")} of ${(left + done).toLocaleString("en-US")} done` : undefined,
      body: groups.length ? (
        <div className="pb-1">{groups}</div>
      ) : next ? (
        muted("That's all for today: the one task due is in Next up.")
      ) : (
        muted("Nothing due today. Calls and follow-ups assigned to you show up on the day they're due.")
      ),
    });
  }

  if (wantWaiting) {
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
    const parts = [
      approvals.length > 0 && plural(approvals.length, "approval", "approvals"),
      needsYou.length > 0 && `${plural(needsYou.length, "contract", "contracts")} to finish`,
      callsToCheck > 0 && `${plural(callsToCheck, "call", "calls")} to check`,
      awaitingSignature.length > 0 && `${awaitingSignature.length.toLocaleString("en-US")} out for signature`,
    ].filter(Boolean);
    lines.push({
      id: "waiting",
      tone: approvals.length + needsYou.length + callsToCheck > 0 ? "due" : "quiet",
      summary: parts.length ? parts.join(" · ") : "Nothing right now",
      body:
        contractItems.length + callsToCheck === 0 ? (
          muted("Nothing waiting on you. Contracts to review and calls to check show up here.")
        ) : (
          <div>
            {callsToCheck > 0 && <WaitingRow href="/calls" title={callsToCheck === 1 ? "1 call needs a look" : `${callsToCheck} calls need a look`} detail="Pick who it was with, or try again" />}
            {contractItems.slice(0, CONTRACTS_SHOWN).map((d, i) => (
              <WaitingRow key={`${d.id}-${i}`} href={`/deals/${d.id}`} title={d.client.name} detail={d.service} chip={{ label: d.label, cls: d.chip }} />
            ))}
            {contractItems.length > CONTRACTS_SHOWN && (
              <Link href="/deals" className="block px-4 py-3 text-[13px] font-medium sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)", color: "var(--accent-blue)" }}>
                {plural(contractItems.length - CONTRACTS_SHOWN, "more contract", "more contracts")} in Deals
              </Link>
            )}
          </div>
        ),
    });
  }

  if (need.has("saved")) {
    const latest = savedCalls.find((c) => c.lead);
    const what = (c: (typeof savedCalls)[number]) => (c.mode === "sales" ? "Deal created" : c.outcome ? (CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome) : "Notes saved");
    const time = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d) : "");
    lines.push({
      id: "saved",
      tone: latest?.processedAt && now.getTime() - latest.processedAt.getTime() < 2 * 60 * 60 * 1000 ? "good" : "quiet",
      summary: latest?.lead ? `${latest.lead.name} · ${what(latest)}` : "No calls written up yet today",
      meta: latest ? time(latest.processedAt) : undefined,
      body:
        savedCalls.length === 0
          ? muted("When you hang up, SealMe writes up the call and it shows up here.")
          : savedCalls.map((c, i) => (
              <Link
                key={c.id}
                href={c.mode === "sales" && c.dealId ? `/deals/${c.dealId}` : c.lead ? `/leads/${c.lead.id}` : "/calls"}
                className="row-hover flex flex-col gap-1 px-4 py-3 sm:px-5"
                style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>{c.lead?.name ?? "Call"}</span>
                  <span className={`chip ${c.mode === "sales" ? "chip-success" : (c.outcome && CALL_OUTCOME_CHIP[c.outcome]) || "chip-neutral"}`}>{what(c)}</span>
                  <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{time(c.processedAt)}</span>
                </div>
                {i === 0 && c.summary && <div className="line-clamp-2 break-words text-[13px]" style={{ color: "var(--ink-muted)" }}>{c.summary}</div>}
              </Link>
            )),
    });
  }

  const notice =
    isTelnyxConfigured() && !me?.phoneVerifiedAt ? (
      <Link href="/settings#phone" className="card row-hover flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--tone-due)" }} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>{me?.phone ? "Verify your phone number" : "Add your phone number"}</div>
          <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>One time, takes a minute. Then a tap on Call rings you and connects your client.</div>
        </div>
        <span aria-hidden style={{ color: "var(--ink-muted)" }}>›</span>
      </Link>
    ) : null;

  return { lines, progress, notice };
}

// The one thing to do now, opened from the Next up line: what you know
// about them and the button that starts the call. Done and Skip move on
// to the next.
function NextUp({ task, overdue }: { task: TaskRow; overdue: boolean }) {
  const lead = task.lead;
  const isCall = task.type === "cold_call" || task.type === "sales_call";
  // An agency rep calls for several clients: say which one first.
  const detail = [lead?.campaign ? `For ${lead.campaign}` : null, lead?.company, TASK_TYPE_LABEL[task.type] ?? task.type, overdue ? `was due ${formatTaskDue(task.dueDate, task.dueTime)}` : task.dueTime ? `due ${task.dueTime}` : "today"]
    .filter(Boolean)
    .join(" · ");
  const facts = [
    lead?.isDecisionMaker === true ? "Decision maker" : lead?.isDecisionMaker === false ? "Not the decision maker" : null,
    lead?.objections ? `Worried about: ${lead.objections}` : null,
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-3 rounded-[18px] p-4 sm:p-5" style={{ background: "var(--surface-inverted)", color: "var(--on-surface-inverted)" }}>
      <div className="flex flex-col gap-0.5">
        <div className="break-words text-[18px] font-semibold" style={{ letterSpacing: "-0.3px" }}>{taskTitle(task)}</div>
        <div className="text-[13px]" style={{ color: "var(--on-surface-inverted-muted)" }}>{detail}</div>
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
