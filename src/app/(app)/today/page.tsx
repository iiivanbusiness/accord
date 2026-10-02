import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { currentUserWithRole } from "@/lib/permissions";
import { cookieTimeZone, dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import { formatPhone } from "@/lib/phone";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/deal-status";
import { formatTaskDue, TASK_TYPE_LABEL } from "@/lib/tasks";
import TodayTaskRow, { type TodayTask } from "@/components/TodayTaskRow";
import { setTaskStatus } from "../leads/task-actions";

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
  lead: { id: string; name: string; company: string | null; title: string | null; phone: string | null } | null;
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
    lead: { select: { id: true, name: true, company: true, title: true, phone: true } },
  } as const;

  const delegations = await prisma.approvalDelegate.findMany({
    where: { toUserId: user.id, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { fromUserId: true },
  });
  const reviewerIds = [user.id, ...delegations.map((d) => d.fromUserId)];

  const [open, finished, myDeals, pendingSteps] = await Promise.all([
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
  ]);

  const overdue = open.filter((t) => t.dueDate < todayDate).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || byPriority(a, b));
  const dueToday = open.filter((t) => t.dueDate.getTime() === todayDate.getTime());
  const coldCalls = dueToday.filter((t) => t.type === "cold_call").sort((a, b) => byPriority(a, b) || byTime(a, b));
  const salesCalls = dueToday.filter((t) => t.type === "sales_call").sort(byTime);
  const followUps = dueToday.filter((t) => t.type !== "cold_call" && t.type !== "sales_call").sort((a, b) => byTime(a, b) || byPriority(a, b));
  const upcoming = open.filter((t) => t.dueDate >= tomorrowDate);

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
        <TodayTaskRow task={toRow(t, when(t))} overdue={opts.overdue} showType={opts.showType} statusAction={setTaskStatus} />
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

      {/* Phones are for cold calling, so those come right after anything
          overdue; on a computer, sales calls and contracts lead. */}
      <div className="flex flex-col gap-4">
        {overdue.length > 0 && (
          <Section title="Overdue" count={overdue.length} tone="warn" className="order-1">
            {rows(overdue, (t) => formatTaskDue(t.dueDate, t.dueTime), { overdue: true, showType: true })}
          </Section>
        )}

        {coldCalls.length > 0 && (
          <Section title="Cold calls" count={coldCalls.length} className="order-2 md:order-4">
            {rows(coldCalls, (t) => t.dueTime ?? "")}
          </Section>
        )}

        {salesCalls.length > 0 && (
          <Section title="Sales calls" count={salesCalls.length} className="order-3 md:order-2">
            {rows(salesCalls, (t) => t.dueTime ?? "Any time")}
          </Section>
        )}

        {contractCount > 0 && (
          <Section title="Contracts" count={contractCount} className="order-5 md:order-3">
            {contractItems.slice(0, CONTRACTS_SHOWN).map((d, i) => (
              <Link
                key={`${d.id}-${i}`}
                href={`/deals/${d.id}`}
                className="row-hover flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{d.client.name}</div>
                  <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{d.service}</div>
                </div>
                <span className={`chip flex-none whitespace-nowrap ${d.chip}`}>{d.label}</span>
              </Link>
            ))}
            {contractCount > CONTRACTS_SHOWN && (
              <Link href="/deals" className="block px-4 py-3 text-[13px] font-medium sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)", color: "var(--accent-blue)" }}>
                {plural(contractCount - CONTRACTS_SHOWN, "more", "more")} in Deals
              </Link>
            )}
          </Section>
        )}

        {followUps.length > 0 && (
          <Section title="Follow-ups and other" count={followUps.length} className="order-4 md:order-5">
            {rows(followUps, (t) => t.dueTime ?? "", { showType: true })}
          </Section>
        )}

        {left === 0 && contractCount === 0 && (
          <div className="card order-1 flex flex-col items-start gap-2 p-6">
            <div className="text-[14.5px] font-medium">{done > 0 ? "All done for today" : "Nothing due today"}</div>
            <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
              {upcoming.length > 0 ? "Your next tasks are below." : "Calls and follow-ups assigned to you will show up here on the day they're due."}
            </div>
          </div>
        )}

        {upcomingDays.size > 0 && (
          <Section title="Coming up" count={upcoming.length} className="order-6">
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
          <details className="card order-7 overflow-hidden">
            <summary className="flex cursor-pointer select-none items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="text-[14px] font-medium">Finished today</span>
              <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{finished.length}</span>
            </summary>
            <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>{rows(finished, () => "", { showType: true })}</div>
          </details>
        )}
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
