import Link from "next/link";
import { prisma } from "@/lib/db";
import { dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import QuickAssign from "@/components/QuickAssign";
import { quickAssignLeads } from "@/app/(app)/leads/task-actions";

type Count = { _count: { _all: number } };
const countsBy = <K extends string>(rows: (Count & Record<K, string | null>)[], key: K) => new Map(rows.map((r) => [r[key] ?? "", r._count._all]));

// The manager's view of today: how the team's calls and tasks are going,
// who's behind, and handing out more work in one line.
export async function TeamToday({ workspaceId, tz, managerId }: { workspaceId: string; tz: string; managerId: string }) {
  const now = new Date();
  const today = new Date(`${dayInZone(now, tz)}T00:00:00Z`);
  const dayStart = startOfDayInZone(now, tz);

  const [members, dueOpen, overdue, done, calls, reached, meetings, freeLeads] = await Promise.all([
    prisma.user.findMany({ where: { workspaceId, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: "open", dueDate: { lte: today } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: "open", dueDate: { lt: today } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: "done", completedAt: { gte: dayStart } }, _count: { _all: true } }),
    prisma.phoneCall.groupBy({ by: ["userId"], where: { workspaceId, source: { not: "paste" }, startedAt: { gte: dayStart }, status: { not: "discarded" } }, _count: { _all: true } }),
    prisma.phoneCall.groupBy({ by: ["userId"], where: { workspaceId, startedAt: { gte: dayStart }, connected: true }, _count: { _all: true } }),
    prisma.phoneCall.groupBy({ by: ["userId"], where: { workspaceId, processedAt: { gte: dayStart }, outcome: "meeting_booked" }, _count: { _all: true } }),
    prisma.lead.count({ where: { workspaceId, ownerId: null, stage: { notIn: ["converted", "lost"] }, tasks: { none: { status: "open" } } } }),
  ]);

  const leftBy = countsBy(dueOpen, "assigneeId");
  const overdueBy = countsBy(overdue, "assigneeId");
  const doneBy = countsBy(done, "assigneeId");
  const callsBy = countsBy(calls, "userId");
  const reachedBy = countsBy(reached, "userId");
  const meetingsBy = countsBy(meetings, "userId");
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  const rows = members
    .map((m) => {
      const left = leftBy.get(m.id) ?? 0;
      const finished = doneBy.get(m.id) ?? 0;
      return { ...m, left, finished, total: left + finished, overdue: overdueBy.get(m.id) ?? 0, calls: callsBy.get(m.id) ?? 0, meetings: meetingsBy.get(m.id) ?? 0 };
    })
    // People with work today first; the manager's own row only if they have some.
    .filter((r) => r.total > 0 || r.calls > 0 || r.id !== managerId)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const tasksDone = sum(doneBy);
  const tasksTotal = tasksDone + sum(leftBy);
  const tiles = [
    { label: "Calls today", value: sum(callsBy).toLocaleString("en-US") },
    { label: "Reached someone", value: sum(reachedBy).toLocaleString("en-US") },
    { label: "Meetings booked", value: sum(meetingsBy).toLocaleString("en-US") },
    { label: "Tasks done", value: tasksTotal ? `${tasksDone.toLocaleString("en-US")} of ${tasksTotal.toLocaleString("en-US")}` : "0" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card flex flex-col gap-1 px-4 py-3.5">
            <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{t.label}</span>
            <span className="text-[24px] font-medium tabular-nums" style={{ letterSpacing: "-0.5px" }}>{t.value}</span>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--hairline-soft)" }}>
          <h2 className="text-[14px] font-medium">Team today</h2>
          <Link href="/team" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>Details</Link>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--ink-muted)" }}>Nobody has work for today yet. Hand some out below.</div>
        ) : (
          rows.map((r, i) => {
            const status =
              r.total === 0 ? { label: "Nothing today", cls: "chip-neutral" } : r.overdue > 0 ? { label: `${r.overdue} overdue`, cls: "chip-warn" } : r.left === 0 ? { label: "All done", cls: "chip-success" } : { label: "On it", cls: "chip-active" };
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5" style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
                <div className="min-w-[120px] flex-1">
                  <div className="truncate text-[14px] font-medium">{r.name}</div>
                  <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                    {r.total ? `${r.finished} of ${r.total} done` : "No tasks"} · {r.calls} {r.calls === 1 ? "call" : "calls"}
                    {r.meetings ? ` · ${r.meetings} ${r.meetings === 1 ? "meeting" : "meetings"}` : ""}
                  </div>
                </div>
                {r.total > 0 && (
                  <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--hairline)" }} aria-hidden>
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round((r.finished / r.total) * 100)}%`, background: "var(--ink)" }} />
                  </div>
                )}
                <span className={`chip flex-none ${status.cls}`}>{status.label}</span>
              </div>
            );
          })
        )}
      </section>

      <QuickAssign members={members.map((m) => ({ id: m.id, name: m.name }))} freeLeads={freeLeads} assignAction={quickAssignLeads} />
    </div>
  );
}
