import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { dayInZone, startOfDayInZone } from "@/lib/viewer-time";
import { formatPhone } from "@/lib/phone";
import { isTelnyxConfigured } from "@/lib/telnyx";
import { TASK_PRIORITY_CHIP, TASK_PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/lib/tasks";
import { CALL_OUTCOME_CHIP, CALL_OUTCOME_LABEL } from "@/lib/call-outcomes";
import { buildTodo, clockIn, type TodoItem, type TodoTask } from "@/lib/todo";
import TodoList, { type TodoRow, type TodoDay } from "@/components/dashboard/TodoList";
import { createTodo, quickAssignLeads, searchTodoLeads, setTaskStatus } from "@/app/(app)/leads/task-actions";
import { startLeadCall } from "@/app/(app)/leads/phone-actions";
import { setTaskDigestEmail } from "@/app/(app)/preferences-actions";

const DAY = 24 * 60 * 60 * 1000;
const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const money = (v: number) => (v >= 10_000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v).toLocaleString("en-US")}`);
const versus = (now: number, before: number, what: string) =>
  now === before ? `Same as ${what}` : `${now > before ? "+" : "−"}${n(Math.abs(now - before))} vs ${what}`;

const taskSelect = {
  id: true,
  type: true,
  status: true,
  dueDate: true,
  dueTime: true,
  priority: true,
  note: true,
  completedAt: true,
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, company: true, campaign: true, phone: true } },
} as const;

type Me = { id: string; name: string; phoneVerifiedAt: Date | null; taskDigestEmail: boolean };

// The top of a prospecting Dashboard: the day in one sentence, four
// numbers, the to-do list in the order the day happens, and (for whoever
// hands out work) the team and the week.
export async function todaySection(o: { workspaceId: string; me: Me; tz: string; team: boolean; canAssign: boolean; phoneInGuide: boolean }) {
  const { workspaceId, me, tz, canAssign } = o;
  const team = canAssign && o.team;
  const now = new Date();
  const today = dayInZone(now, tz);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const tomorrowDate = new Date(todayDate.getTime() + DAY);
  const horizon = new Date(todayDate.getTime() + 8 * DAY);
  const dayStart = startOfDayInZone(now, tz);
  const yesterdayStart = new Date(dayStart.getTime() - DAY);
  // Weeks start on Monday.
  const weekday = (todayDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(dayStart.getTime() - weekday * DAY);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY);
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00Z`);

  const whose = team ? {} : { assigneeId: me.id };
  // A meeting counts for whoever booked it: who added the sales call, or
  // whose it is when it came in through the API.
  const bookedBy = team ? {} : { OR: [{ createdById: me.id }, { createdById: null, assigneeId: me.id }] };
  const callsBy = team ? {} : { userId: me.id };
  const { where: dealVisibility } = await dealVisibilityFilter();

  const [members, allTasks, upcomingTasks, allCalls, events, approvals, myDeals, callsToCheck, callsYesterday, meetingsThisWeek, meetingsLastWeek, signed, weekCalls, freeLeads] = await Promise.all([
    prisma.user.findMany({ where: { workspaceId, deactivatedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // Today's tasks and calls for the whole team when this person runs it
    // (the Team card needs them even on "Mine"), otherwise just theirs.
    prisma.task.findMany({
      where: {
        workspaceId,
        ...(canAssign ? {} : { assigneeId: me.id }),
        OR: [
          { status: "open", dueDate: { lt: tomorrowDate } },
          { status: { in: ["done", "skipped"] }, completedAt: { gte: dayStart } },
        ],
      },
      select: taskSelect,
      take: 1000,
    }),
    prisma.task.findMany({ where: { workspaceId, ...whose, status: "open", dueDate: { gte: tomorrowDate, lt: horizon } }, select: taskSelect, orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }], take: 200 }),
    prisma.phoneCall.findMany({
      where: { workspaceId, ...(canAssign ? {} : { userId: me.id }), startedAt: { gte: dayStart }, status: { in: ["processed", "skipped"] }, leadId: { not: null } },
      select: { id: true, mode: true, status: true, outcome: true, startedAt: true, dealId: true, user: { select: { id: true, name: true } }, lead: { select: { id: true, name: true, company: true } } },
      orderBy: { startedAt: "asc" },
      take: 300,
    }),
    // The workspace calendar is the managers' to read; reps get their
    // meetings as sales call to-dos.
    canAssign
      ? prisma.calendarEvent.findMany({ where: { workspaceId, startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + 8 * DAY) } }, select: { id: true, title: true, clientName: true, startTime: true, platform: true, meetingUrl: true }, orderBy: { startTime: "asc" } })
      : [],
    // Contracts waiting on this person: their review step, and their own
    // deals that need finishing.
    prisma.reviewStep.findMany({
      where: { status: "pending", assigneeId: me.id, contract: { deal: { workspaceId, trashedAt: null } } },
      select: { id: true, contract: { select: { reviewSteps: { where: { status: "pending" }, orderBy: { order: "asc" }, take: 1, select: { id: true } }, deal: { select: { id: true, service: true, client: { select: { name: true } } } } } } },
      take: 20,
    }),
    prisma.deal.count({ where: { workspaceId, ownerId: me.id, trashedAt: null, status: { in: ["ready", "missing_info", "changes_requested"] } } }),
    prisma.phoneCall.count({ where: { workspaceId, userId: me.id, status: { in: ["pending", "failed"] } } }),
    prisma.phoneCall.count({ where: { workspaceId, ...callsBy, startedAt: { gte: yesterdayStart, lt: dayStart }, status: { in: ["processed", "skipped"] } } }),
    prisma.task.count({ where: { workspaceId, ...bookedBy, type: "sales_call", createdAt: { gte: weekStart } } }),
    prisma.task.count({ where: { workspaceId, ...bookedBy, type: "sales_call", createdAt: { gte: lastWeekStart, lt: weekStart } } }),
    prisma.contract.findMany({ where: { signedAt: { gte: monthStart }, deal: { workspaceId, trashedAt: null, ...dealVisibility } }, select: { deal: { select: { feeDisplay: true } } } }),
    prisma.phoneCall.findMany({ where: { workspaceId, ...callsBy, startedAt: { gte: weekStart }, status: { in: ["processed", "skipped"] } }, select: { startedAt: true, outcome: true }, take: 5000 }),
    canAssign ? prisma.lead.count({ where: { workspaceId, ownerId: null, stage: { notIn: ["converted", "lost"] }, tasks: { none: { status: "open" } } } }) : 0,
  ]);

  // A meeting that's both a sales call to-do and on the calendar shows
  // once, as the to-do.
  const isTodo = (e: (typeof events)[number]) =>
    [...allTasks, ...upcomingTasks].some((t) => t.type === "sales_call" && t.lead && e.clientName === t.lead.name && t.dueDate.toISOString().slice(0, 10) === dayInZone(e.startTime, tz) && t.dueTime === clockIn(e.startTime, tz));
  const tasks = team ? allTasks : allTasks.filter((t) => t.assignee?.id === me.id);
  const calls = team ? allCalls : allCalls.filter((c) => c.user?.id === me.id);
  const todayEvents = events.filter((e) => dayInZone(e.startTime, tz) === today && !isTodo(e));
  const todo = buildTodo({ tasks, calls, events: todayEvents, now, today, tz, meId: me.id });

  // How a task, call or meeting reads in the list.
  const who = (p: { id: string; name: string } | null) => (p ? (p.id === me.id ? "You" : firstName(p.name)) : "Unassigned");
  const from = (t: TodoTask) => (t.createdBy && t.assignee && t.createdBy.id !== t.assignee.id ? `from ${t.createdBy.id === me.id ? "you" : firstName(t.createdBy.name)}` : null);
  const taskTitle = (t: TodoTask) => {
    if (!t.lead) return t.note ?? TASK_TYPE_LABEL[t.type] ?? "Task";
    if (t.type === "cold_call") return `Call ${t.lead.name}`;
    if (t.type === "sales_call") return `Sales call: ${t.lead.name}`;
    if (t.type === "follow_up") return `Follow up with ${t.lead.name}`;
    return `${TASK_TYPE_LABEL[t.type] ?? "Task"}: ${t.lead.name}`;
  };
  // What's done reads as done: "Called Hannah Price", not "Call Hannah Price".
  const doneTitle = (t: TodoTask) => {
    if (!t.lead || t.status === "skipped") return taskTitle(t);
    if (t.type === "cold_call") return `Called ${t.lead.name}`;
    if (t.type === "sales_call") return `Sales call with ${t.lead.name}`;
    if (t.type === "follow_up") return `Followed up with ${t.lead.name}`;
    return taskTitle(t);
  };
  const taskRow = (t: TodoTask, time: string | null, extra: { late?: boolean; outcome?: string | null } = {}): TodoRow => {
    const finished = t.status !== "open";
    const outcome = extra.outcome ? { label: CALL_OUTCOME_LABEL[extra.outcome] ?? extra.outcome, cls: CALL_OUTCOME_CHIP[extra.outcome] ?? "chip-neutral" } : null;
    const priority = !finished && TASK_PRIORITY_CHIP[t.priority] ? { label: TASK_PRIORITY_LABEL[t.priority], cls: TASK_PRIORITY_CHIP[t.priority]! } : null;
    return {
      key: `t-${t.id}`,
      kind: "task",
      time,
      late: Boolean(extra.late),
      title: finished ? doneTitle(t) : taskTitle(t),
      href: t.lead ? `/leads/${t.lead.id}` : null,
      detail: [t.lead?.campaign ? `For ${t.lead.campaign}` : null, t.lead?.company, t.lead ? (t.note ?? null) : null, from(t)].filter(Boolean).join(" · "),
      who: team ? who(t.assignee) : null,
      status: finished ? (t.status as "done" | "skipped") : "open",
      chip: finished ? (outcome ?? { label: t.status === "done" ? "Done" : "Skipped", cls: t.status === "done" ? "chip-success" : "chip-neutral" }) : priority,
      taskId: t.id,
      mine: t.assignee?.id === me.id,
      call: !finished && t.lead?.phone && (t.type === "cold_call" || t.type === "sales_call" || t.type === "follow_up") ? { leadId: t.lead.id, leadName: t.lead.name, phone: formatPhone(t.lead.phone) } : null,
      next: t.id === todo.nextId,
    };
  };
  const itemRow = (i: TodoItem): TodoRow => {
    if (i.kind === "task") return taskRow(i.task, i.time, { late: i.late, outcome: i.outcome });
    if (i.kind === "call") {
      const c = i.call;
      const outcome = c.mode === "sales" ? { label: "Deal created", cls: "chip-success" } : c.outcome ? { label: CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome, cls: CALL_OUTCOME_CHIP[c.outcome] ?? "chip-neutral" } : null;
      return {
        key: `c-${c.id}`,
        kind: "call",
        time: i.time,
        late: false,
        title: `${c.user?.id === me.id ? "You" : firstName(c.user?.name ?? "Someone")} called ${c.lead?.name ?? "a lead"}`,
        href: c.mode === "sales" && c.dealId ? `/deals/${c.dealId}` : c.lead ? `/leads/${c.lead.id}` : "/calls",
        detail: c.lead?.company ?? "",
        who: null,
        status: "done",
        chip: outcome,
        taskId: null,
        mine: c.user?.id === me.id,
        call: null,
        next: false,
      };
    }
    const e = i.event;
    return {
      key: `e-${e.id}`,
      kind: "event",
      time: i.time,
      late: false,
      title: e.title,
      href: e.meetingUrl ?? "/calendar",
      detail: e.platform === "meet" ? "Google Meet" : "Zoom",
      who: null,
      status: i.past ? "done" : "event",
      chip: null,
      taskId: null,
      mine: true,
      call: null,
      next: false,
    };
  };

  // Late from before: one row each, or one per person when a teammate is
  // far behind, so the list stays readable.
  const overdueRows: TodoRow[] = [];
  const lateBy = new Map<string, TodoTask[]>();
  for (const t of todo.overdue) lateBy.set(t.assignee?.id ?? "", [...(lateBy.get(t.assignee?.id ?? "") ?? []), t]);
  for (const [, list] of lateBy) {
    const person = list[0].assignee;
    if (team && list.length > 3 && person?.id !== me.id) {
      overdueRows.push({
        key: `late-${person?.id ?? "none"}`,
        kind: "summary",
        time: null,
        late: true,
        title: `${who(person)} has ${plural(list.length, "late task", "late tasks")}`,
        href: "/team",
        detail: `Oldest from ${new Date(list[0].dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}. Move them to someone else in Team`,
        who: null,
        status: "open",
        chip: null,
        taskId: null,
        mine: false,
        call: null,
        next: false,
      });
    } else {
      for (const t of list) {
        const yesterday = t.dueDate.getTime() === todayDate.getTime() - DAY;
        const day = yesterday ? "Yesterday" : t.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        overdueRows.push(taskRow(t, t.dueTime ? `${day} ${t.dueTime}` : day, { late: true }));
      }
    }
  }

  // Contracts that need this person, as to-dos with no particular time.
  const myApprovals = approvals.filter((s) => s.contract.reviewSteps[0]?.id === s.id).map((s) => s.contract.deal);
  const waitingRows: TodoRow[] = [
    ...myApprovals.slice(0, 3).map((d) => ({
      key: `a-${d.id}`,
      kind: "summary" as const,
      time: null,
      late: false,
      title: `Approve the contract for ${d.client.name}`,
      href: `/deals/${d.id}/contract`,
      detail: d.service,
      who: null,
      status: "open" as const,
      chip: { label: "Approval", cls: "chip-warn" },
      taskId: null,
      mine: true,
      call: null,
      next: false,
    })),
    ...(myDeals > 0
      ? [{ key: "deals", kind: "summary" as const, time: null, late: false, title: `Finish ${plural(myDeals, "contract", "contracts")}`, href: "/deals", detail: "Fill in what's missing, review and send", who: null, status: "open" as const, chip: null, taskId: null, mine: true, call: null, next: false }]
      : []),
    ...(callsToCheck > 0
      ? [{ key: "check", kind: "summary" as const, time: null, late: false, title: `Check ${plural(callsToCheck, "call", "calls")}`, href: "/calls", detail: "Pick who it was with, or try again", who: null, status: "open" as const, chip: null, taskId: null, mine: true, call: null, next: false }]
      : []),
  ];

  // The next week, one line per day.
  const days = new Map<string, { time: string; title: string }[]>();
  for (const t of upcomingTasks) {
    const key = t.dueDate.toISOString().slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), { time: t.dueTime ?? "", title: `${team ? `${who(t.assignee)}: ` : ""}${taskTitle(t)}` }]);
  }
  for (const e of events) {
    const key = dayInZone(e.startTime, tz);
    if (key <= today || isTodo(e)) continue;
    days.set(key, [...(days.get(key) ?? []), { time: clockIn(e.startTime, tz), title: e.title }]);
  }
  const upcoming: TodoDay[] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      // "Fri 9": short enough for the time column.
      label: key === tomorrowDate.toISOString().slice(0, 10) ? "Tomorrow" : `${new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${Number(key.slice(8))}`,
      items: items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    }));

  // The numbers, from the viewer's own day.
  const mineOpen = tasks.filter((t) => t.status === "open" && t.assignee?.id === me.id);
  const mineLate = mineOpen.filter((t) => t.dueDate < todayDate).length;
  const mineToday = mineOpen.length - mineLate;
  const myMeetingsThisWeek = [...tasks, ...upcomingTasks].filter((t) => t.type === "sales_call" && t.status === "open" && t.assignee?.id === me.id && t.dueDate.getTime() < todayDate.getTime() + (7 - weekday) * DAY).length;
  const sentence = [
    mineToday > 0 ? `${plural(mineToday, "to-do", "to-dos")} left today` : "Nothing left today",
    mineLate > 0 ? `${n(mineLate)} late` : null,
    myMeetingsThisWeek > 0 ? `${plural(myMeetingsThisWeek, "meeting", "meetings")} this week` : null,
  ].filter(Boolean) as string[];

  const signedValue = signed.reduce((s, c) => s + parseFee(c.deal.feeDisplay), 0);
  const callsToday = calls.length;
  const waitingCount = myApprovals.length + myDeals + callsToCheck;
  const stats = [
    { label: team ? "Team calls today" : "Calls today", value: n(callsToday), sub: versus(callsToday, callsYesterday, "yesterday") },
    { label: "Meetings booked this week", value: n(meetingsThisWeek), sub: versus(meetingsThisWeek, meetingsLastWeek, "last week") },
    {
      label: "Waiting on you",
      value: n(waitingCount),
      sub: [myApprovals.length && plural(myApprovals.length, "approval", "approvals"), myDeals && plural(myDeals, "contract", "contracts"), callsToCheck && plural(callsToCheck, "call", "calls")].filter(Boolean).join(" · ") || "Nothing right now",
    },
    { label: "Signed this month", value: money(signedValue), sub: plural(signed.length, "contract", "contracts") },
  ];

  // The team today, for whoever hands out work.
  const teamRows = canAssign
    ? members
        .map((m) => {
          const theirs = allTasks.filter((t) => t.assignee?.id === m.id);
          const done = theirs.filter((t) => t.status === "done").length;
          const left = theirs.filter((t) => t.status === "open").length;
          const late = theirs.filter((t) => t.status === "open" && t.dueDate < todayDate).length;
          return { id: m.id, name: m.id === me.id ? "You" : m.name, done, total: done + left, late, calls: allCalls.filter((c) => c.user?.id === m.id).length };
        })
        .filter((r) => r.total > 0 || r.calls > 0 || r.id !== me.id)
        .sort((a, b) => b.late - a.late || b.total - a.total || a.name.localeCompare(b.name))
    : [];

  // Calls per weekday this week; the weekend only when someone called.
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const day = dayInZone(new Date(weekStart.getTime() + i * DAY + 12 * 60 * 60 * 1000), tz);
    const these = weekCalls.filter((c) => dayInZone(c.startedAt, tz) === day);
    return { day, label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), calls: these.length, meetings: these.filter((c) => c.outcome === "meeting_booked").length };
  }).filter((d, i) => i < 5 || d.calls > 0);
  const maxCalls = Math.max(1, ...perDay.map((d) => d.calls));

  const phoneNotice = isTelnyxConfigured() && !me.phoneVerifiedAt && !o.phoneInGuide;
  const rows = { overdue: overdueRows, done: todo.done.map(itemRow), coming: todo.coming.map(itemRow), anytime: [...todo.anytime.map((t) => taskRow(t, null)), ...waitingRows] };

  return {
    sentence: sentence.join(", "),
    block: (
      <div className="mb-8 flex flex-col gap-4">
        {phoneNotice && (
          <Link href="/settings#phone" className="card row-hover flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: "var(--tone-due)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>Add your phone number</div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>One time, takes a minute. Then a tap on Call rings you and connects your client.</div>
            </div>
            <span aria-hidden style={{ color: "var(--ink-muted)" }}>›</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="glass-card glass-card-solid flex flex-col gap-1 p-4 sm:p-5">
              <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{s.label}</div>
              <div className="font-mono-tab text-[26px] font-medium leading-tight" style={{ letterSpacing: "-0.5px" }}>{s.value}</div>
              <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }} title={s.sub}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <TodoList
            rows={rows}
            upcoming={upcoming}
            nowLabel={clockIn(now, tz)}
            team={team}
            canAssign={canAssign}
            members={members.map((m) => ({ id: m.id, name: m.id === me.id ? `${m.name} (you)` : m.name }))}
            meId={me.id}
            freeLeads={freeLeads}
            digestEnabled={me.taskDigestEmail}
            statusAction={setTaskStatus}
            callAction={startLeadCall}
            createAction={createTodo}
            searchAction={searchTodoLeads}
            assignAction={quickAssignLeads}
            digestAction={setTaskDigestEmail}
          />

          <div className="flex flex-col gap-4">
            {canAssign && (
              <section className="glass-card glass-card-solid p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-medium">Team today</h2>
                  <Link href="/team" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>Details</Link>
                </div>
                {teamRows.length === 0 ? (
                  <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>Nobody has work for today yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {teamRows.map((r) => {
                      const segments = 10;
                      const on = r.total ? Math.round((r.done / r.total) * segments) : 0;
                      return (
                        <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto_64px] items-center gap-3 text-[13px]">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{r.name}</div>
                            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{plural(r.calls, "call", "calls")} today</div>
                          </div>
                          <div className="flex gap-[2px]" aria-hidden>
                            {Array.from({ length: segments }, (_, i) => (
                              <span key={i} className="h-3.5 w-[4px] rounded-[1px]" style={{ background: i < on ? "var(--ink)" : "var(--hairline)" }} />
                            ))}
                          </div>
                          <div className="text-right text-[12.5px] tabular-nums" style={{ color: r.late ? "var(--tone-urgent)" : "var(--ink-muted)", fontWeight: r.late ? 500 : undefined }}>
                            {r.late ? `${n(r.late)} late` : r.total ? `${r.done} / ${r.total}` : "Nothing"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="glass-card glass-card-solid p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-medium">{team ? "Team calls this week" : "Your calls this week"}</h2>
                <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{plural(weekCalls.length, "call", "calls")}</span>
              </div>
              <div className="flex h-[120px] items-end gap-2">
                {perDay.map((d) => {
                  const future = d.day > today;
                  const isToday = d.day === today;
                  return (
                    <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-muted)" }}>{future ? "" : d.calls}</span>
                      <div
                        className="w-full rounded-[6px]"
                        title={`${d.label}: ${plural(d.calls, "call", "calls")}, ${plural(d.meetings, "meeting", "meetings")}`}
                        style={
                          future
                            ? { height: 8, border: "1px dashed var(--hairline)" }
                            : { height: `${Math.max(6, Math.round((d.calls / maxCalls) * 76))}px`, background: isToday ? "var(--ink)" : "var(--hairline)" }
                        }
                      />
                      <span className="text-[11.5px]" style={{ color: isToday ? "var(--ink)" : "var(--ink-muted)", fontWeight: isToday ? 500 : undefined }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
                {plural(perDay.reduce((s, d) => s + d.meetings, 0), "meeting", "meetings")} booked from calls this week
              </div>
            </section>
          </div>
        </div>
      </div>
    ),
  };
}
