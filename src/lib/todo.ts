// The Dashboard to-do list, in the order a day actually happens: what's
// late from before, what's been done today (with how the call went), a
// "now" line, what's still coming today by the clock, then what can be
// done any time today. Pure, so the order can be tested.

export type TodoPerson = { id: string; name: string };

export type TodoTask = {
  id: string;
  type: string;
  status: string;
  dueDate: Date; // the day, at UTC midnight
  dueTime: string | null; // HH:mm
  priority: string;
  note: string | null;
  completedAt: Date | null;
  assignee: TodoPerson | null;
  createdBy: TodoPerson | null;
  lead: { id: string; name: string; company: string | null; campaign: string | null; phone: string | null } | null;
};

export type TodoCall = {
  id: string;
  mode: string;
  status: string;
  outcome: string | null;
  startedAt: Date;
  user: TodoPerson | null;
  lead: { id: string; name: string; company: string | null } | null;
  dealId: string | null;
};

export type TodoEvent = { id: string; title: string; startTime: Date; platform: string; meetingUrl: string | null };

export type TodoItem =
  | { kind: "task"; time: string | null; late: boolean; task: TodoTask; outcome: string | null }
  | { kind: "call"; time: string; call: TodoCall }
  | { kind: "event"; time: string; past: boolean; event: TodoEvent };

export type Todo = {
  overdue: TodoTask[];
  done: TodoItem[]; // before the "now" line
  coming: TodoItem[]; // after it
  anytime: TodoTask[];
  nextId: string | null; // the viewer's own next task
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const byPriority = (a: TodoTask, b: TodoTask) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
const byDue = (a: TodoTask, b: TodoTask) => a.dueDate.getTime() - b.dueDate.getTime() || (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");

export function clockIn(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(date);
}

// A call that a finished task already stands for isn't listed twice.
const sameWork = (t: TodoTask, c: TodoCall) => Boolean(t.lead && c.lead && t.lead.id === c.lead.id && t.assignee && c.user && t.assignee.id === c.user.id);

export function buildTodo(o: {
  tasks: TodoTask[]; // open ones up to today, and the ones finished today
  calls: TodoCall[]; // made today
  events: TodoEvent[]; // on today's calendar
  now: Date;
  today: string; // YYYY-MM-DD in tz
  tz: string;
  meId: string;
}): Todo {
  const todayDate = new Date(`${o.today}T00:00:00Z`).getTime();
  const nowClock = clockIn(o.now, o.tz);
  const open = o.tasks.filter((t) => t.status === "open");
  const finished = o.tasks.filter((t) => t.status !== "open" && t.completedAt);

  const overdue = open.filter((t) => t.dueDate.getTime() < todayDate).sort(byDue);
  const today = open.filter((t) => t.dueDate.getTime() === todayDate);
  const timed = today.filter((t) => t.dueTime);
  const anytime = today.filter((t) => !t.dueTime).sort(byPriority);

  // The latest call behind each finished task gives it its outcome.
  const outcomeOf = (t: TodoTask) =>
    o.calls
      .filter((c) => sameWork(t, c))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]?.outcome ?? null;

  const done: TodoItem[] = [
    ...finished.map((t) => ({ kind: "task" as const, time: clockIn(t.completedAt!, o.tz), late: false, task: t, outcome: outcomeOf(t) })),
    ...o.calls.filter((c) => !finished.some((t) => sameWork(t, c))).map((c) => ({ kind: "call" as const, time: clockIn(c.startedAt, o.tz), call: c })),
    ...timed.filter((t) => t.dueTime! <= nowClock).map((t) => ({ kind: "task" as const, time: t.dueTime, late: true, task: t, outcome: null })),
    ...o.events.filter((e) => e.startTime <= o.now).map((e) => ({ kind: "event" as const, time: clockIn(e.startTime, o.tz), past: true, event: e })),
  ];
  const coming: TodoItem[] = [
    ...timed.filter((t) => t.dueTime! > nowClock).map((t) => ({ kind: "task" as const, time: t.dueTime, late: false, task: t, outcome: null })),
    ...o.events.filter((e) => e.startTime > o.now).map((e) => ({ kind: "event" as const, time: clockIn(e.startTime, o.tz), past: false, event: e })),
  ];
  const byTime = (a: TodoItem, b: TodoItem) => (a.time ?? "").localeCompare(b.time ?? "");
  done.sort(byTime);
  coming.sort(byTime);

  // The viewer's next thing: anything late first, then what's due within
  // half an hour, then today's untimed work by priority, then the rest of
  // today by the clock.
  const mine = (t: TodoTask) => t.assignee?.id === o.meId;
  const soon = clockIn(new Date(o.now.getTime() + 30 * 60 * 1000), o.tz);
  const next = [
    ...overdue.filter(mine),
    ...timed.filter((t) => mine(t) && t.dueTime! <= soon).sort((a, b) => a.dueTime!.localeCompare(b.dueTime!)),
    ...anytime.filter(mine),
    ...timed.filter((t) => mine(t) && t.dueTime! > soon).sort((a, b) => a.dueTime!.localeCompare(b.dueTime!)),
  ][0];

  return { overdue, done, coming, anytime, nextId: next?.id ?? null };
}
