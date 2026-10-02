import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { cookieTimeZone, dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import TeamTable, { type TeamRow } from "@/components/TeamTable";
import { moveTasks } from "./actions";

const PERIODS = [
  { key: "", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
] as const;

const DAY = 24 * 60 * 60 * 1000;

// Calls that lasted at least this long count as connected: shorter ones
// are usually no answer or a voicemail greeting.
const CONNECTED_SECONDS = 30;

type Counted = { _count: { _all: number } };
function countsBy<K extends string>(rows: (Counted & Record<K, string | null>)[], key: K): Map<string, number> {
  return new Map(rows.map((r) => [r[key] ?? "unassigned", r._count._all]));
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  // Only people who hand out the work see how it's going.
  if (!access.canAssign) redirect("/today");

  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod === "7d" || rawPeriod === "30d" ? rawPeriod : "";
  const tz = await cookieTimeZone();
  const now = new Date();
  const todayDate = new Date(`${dayInZone(now, tz)}T00:00:00Z`);
  const since = period === "7d" ? new Date(now.getTime() - 7 * DAY) : period === "30d" ? new Date(now.getTime() - 30 * DAY) : startOfDayInZone(now, tz);
  const ws = workspace.id;

  const [members, open, overdue, due, done, calls, connected, converted] = await Promise.all([
    prisma.user.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, deactivatedAt: true, role: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId: ws, status: "open" }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId: ws, status: "open", dueDate: { lt: todayDate } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId: ws, status: "open", dueDate: { lte: todayDate } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId: ws, status: "done", completedAt: { gte: since } }, _count: { _all: true } }),
    prisma.phoneCall.groupBy({ by: ["userId"], where: { workspaceId: ws, startedAt: { gte: since } }, _count: { _all: true } }),
    prisma.phoneCall.groupBy({ by: ["userId"], where: { workspaceId: ws, startedAt: { gte: since }, durationSec: { gte: CONNECTED_SECONDS } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["ownerId"], where: { workspaceId: ws, convertedAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const openBy = countsBy(open, "assigneeId");
  const overdueBy = countsBy(overdue, "assigneeId");
  const dueBy = countsBy(due, "assigneeId");
  const doneBy = countsBy(done, "assigneeId");
  const callsBy = countsBy(calls, "userId");
  const connectedBy = countsBy(connected, "userId");
  const convertedBy = countsBy(converted, "ownerId");

  const row = (id: string, name: string, detail: string): TeamRow => ({
    id,
    name,
    detail,
    open: openBy.get(id) ?? 0,
    overdue: overdueBy.get(id) ?? 0,
    due: dueBy.get(id) ?? 0,
    done: doneBy.get(id) ?? 0,
    calls: callsBy.get(id) ?? 0,
    connected: connectedBy.get(id) ?? 0,
    converted: convertedBy.get(id) ?? 0,
  });

  // Everyone active, plus anyone deactivated who still has open tasks (so
  // they can be handed on), plus tasks whose assignee was removed.
  const rows = members
    .filter((m) => !m.deactivatedAt || (openBy.get(m.id) ?? 0) > 0)
    .map((m) => row(m.id, m.name, m.deactivatedAt ? "Deactivated" : (m.role?.name ?? "No role")));
  if ((openBy.get("unassigned") ?? 0) > 0) rows.push(row("unassigned", "Unassigned", "Their teammate was removed"));

  const recipients = members.filter((m) => !m.deactivatedAt).map((m) => ({ id: m.id, name: m.name }));
  const total = (k: keyof Pick<TeamRow, "open" | "overdue" | "done" | "calls" | "connected" | "converted">) => rows.reduce((n, r) => n + r[k], 0);
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  return (
    <>
      <div className="mb-4">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Team</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          {total("open").toLocaleString("en-US")} open {total("open") === 1 ? "task" : "tasks"}
          {total("overdue") > 0 ? `, ${total("overdue").toLocaleString("en-US")} overdue` : ""}. {total("done").toLocaleString("en-US")} done, {total("calls").toLocaleString("en-US")} {total("calls") === 1 ? "call" : "calls"} and {total("converted").toLocaleString("en-US")} converted {periodLabel === "today" ? "today" : `in the ${periodLabel}`}.
        </div>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={p.key ? `/team?period=${p.key}` : "/team"}
            className="btn btn-sm"
            style={period === p.key ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <TeamTable rows={rows} recipients={recipients} moveAction={moveTasks} />

      <div className="mt-3 max-w-[640px] text-[12px]" style={{ color: "var(--ink-muted)" }}>
        Open tasks are what&apos;s on each person&apos;s list right now. Done, calls, connected and converted count {periodLabel === "today" ? "today" : `the ${periodLabel}`}. Calls are calls made through SealMe; connected means the call lasted at least {CONNECTED_SECONDS} seconds.
      </div>
    </>
  );
}
