import Link from "next/link";
import { prisma } from "@/lib/db";
import { dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import QuickAssign from "@/components/QuickAssign";
import type { DashboardLine } from "@/components/DashboardLines";
import type { LineId } from "@/lib/dashboard-lines";
import { quickAssignLeads } from "@/app/(app)/leads/task-actions";

type Count = { _count: { _all: number } };
const countsBy = <K extends string>(rows: (Count & Record<K, string | null>)[], key: K) => new Map(rows.map((r) => [r[key] ?? "", r._count._all]));
const n = (v: number) => v.toLocaleString("en-US");

// The manager's lines: how the team's day is going (who's behind, who's
// on it) and handing out more work.
export async function teamLines({ workspaceId, tz, managerId, need }: { workspaceId: string; tz: string; managerId: string; need: Set<LineId> }): Promise<DashboardLine[]> {
  if (!need.has("team") && !need.has("assign")) return [];
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
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));

  const tasksDone = sum(doneBy);
  const tasksTotal = tasksDone + sum(leftBy);
  const behind = rows.filter((r) => r.overdue > 0);
  const idle = rows.filter((r) => r.total === 0 && r.id !== managerId);
  const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
  const lines: DashboardLine[] = [];

  if (need.has("team")) {
    const stats = `${n(sum(callsBy))} ${sum(callsBy) === 1 ? "call" : "calls"} · ${n(sum(reachedBy))} reached · ${n(sum(meetingsBy))} ${sum(meetingsBy) === 1 ? "meeting" : "meetings"}`;
    lines.push({
      id: "team",
      tone: behind.length ? "urgent" : tasksTotal === 0 && sum(callsBy) === 0 ? "quiet" : "good",
      summary: behind.length
        ? `${firstName(behind[0].name)} is behind: ${n(behind[0].overdue)} overdue${behind.length > 1 ? ` · ${behind.length - 1} more behind` : ""}`
        : tasksTotal === 0 && sum(callsBy) === 0
          ? "Nobody has work for today yet"
          : stats,
      meta: tasksTotal ? `${n(tasksDone)} of ${n(tasksTotal)} done` : undefined,
      body: (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[12.5px] sm:px-5" style={{ color: "var(--ink-muted)", background: "var(--canvas)" }}>
            <span>{stats}</span>
            <Link href="/team" className="font-medium" style={{ color: "var(--accent-blue)" }}>Details</Link>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--ink-muted)" }}>Nobody has work for today yet. Hand some out with the Hand out work line.</div>
          ) : (
            rows.map((r) => {
              const status =
                r.total === 0
                  ? { label: "Nothing today", cls: "chip-neutral" }
                  : r.overdue > 0
                    ? { label: `${n(r.overdue)} overdue`, cls: "chip-danger" }
                    : r.left === 0
                      ? { label: "All done", cls: "chip-success" }
                      : r.finished === 0 && r.calls === 0
                        ? { label: "Not started", cls: "chip-warn" }
                        : { label: "On it", cls: "chip-active" };
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
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
        </div>
      ),
    });
  }

  if (need.has("assign")) {
    lines.push({
      id: "assign",
      tone: "quiet",
      summary:
        freeLeads === 0
          ? "Every lead has someone on it"
          : `${n(freeLeads)} ${freeLeads === 1 ? "lead" : "leads"} nobody is working on${idle.length ? ` · ${idle.length === 1 ? `${firstName(idle[0].name)} has` : `${idle.length} people have`} nothing today` : ""}`,
      // Whoever has nothing today is offered first, the manager last.
      body: (
        <QuickAssign
          embedded
          members={[...members].sort((a, b) => Number(a.id === managerId) - Number(b.id === managerId) || Number(!idle.some((r) => r.id === a.id)) - Number(!idle.some((r) => r.id === b.id))).map((m) => ({ id: m.id, name: m.name }))}
          freeLeads={freeLeads}
          assignAction={quickAssignLeads}
        />
      ),
    });
  }

  return lines;
}
