// One person's to-dos for today, sorted so the list stays short however
// many there are: the one thing to do next, what's set for a time (few, by
// nature), the cold calls as a queue (one row, however many), and the rest
// (follow-ups and other to-dos). Late work and what's done are counted and
// opened on demand. Pure, so the sorting can be tested.

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
  createdAt: Date;
  assignee: TodoPerson | null;
  createdBy: TodoPerson | null;
  lead: { id: string; name: string; company: string | null; campaign: string | null; phone: string | null } | null;
};

export type DayPlan = {
  next: TodoTask | null;
  late: TodoTask[]; // from before today, oldest first
  scheduled: TodoTask[]; // today, set for a time, by the clock
  queue: TodoTask[]; // today's cold calls with no time, in calling order
  other: TodoTask[]; // today's other untimed to-dos, most important first
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const byPriority = (a: TodoTask, b: TodoTask) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
const byCreated = (a: TodoTask, b: TodoTask) => a.createdAt.getTime() - b.createdAt.getTime();
const byDue = (a: TodoTask, b: TodoTask) => a.dueDate.getTime() - b.dueDate.getTime() || (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");

export function clockIn(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(date);
}

// queueMode: the person is working through their cold calls, so the next
// one is always the top of the queue.
export function planDay(o: { open: TodoTask[]; now: Date; today: string; tz: string; queueMode?: boolean }): DayPlan {
  const todayDate = new Date(`${o.today}T00:00:00Z`).getTime();
  const late = o.open.filter((t) => t.dueDate.getTime() < todayDate).sort(byDue);
  const today = o.open.filter((t) => t.dueDate.getTime() === todayDate);
  const scheduled = today.filter((t) => t.dueTime).sort((a, b) => a.dueTime!.localeCompare(b.dueTime!));
  const queue = today.filter((t) => !t.dueTime && t.type === "cold_call").sort((a, b) => byPriority(a, b) || byCreated(a, b));
  const other = today.filter((t) => !t.dueTime && t.type !== "cold_call").sort((a, b) => byPriority(a, b) || byCreated(a, b));

  // Next: the queue's top when working through it; otherwise anything late,
  // then what's due within half an hour, then the untimed to-dos, then the
  // queue, then the rest of the day by the clock.
  const soon = clockIn(new Date(o.now.getTime() + 30 * 60 * 1000), o.tz);
  const next = o.queueMode
    ? (queue[0] ?? null)
    : (late[0] ?? scheduled.find((t) => t.dueTime! <= soon) ?? other[0] ?? queue[0] ?? scheduled[0] ?? null);
  const without = (list: TodoTask[]) => (next ? list.filter((t) => t.id !== next.id) : list);
  return { next, late: without(late), scheduled: without(scheduled), queue: without(queue), other: without(other) };
}
