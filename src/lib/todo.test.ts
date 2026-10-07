import { describe, expect, it } from "vitest";
import { planDay, type TodoTask } from "./todo";

const me = { id: "u1", name: "Ivan" };
let n = 0;
const task = (id: string, o: Partial<TodoTask> = {}): TodoTask => ({
  id,
  type: "cold_call",
  status: "open",
  dueDate: new Date("2026-10-07T00:00:00Z"),
  dueTime: null,
  priority: "normal",
  note: null,
  completedAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, n++)),
  assignee: me,
  createdBy: me,
  lead: { id: `lead-${id}`, name: id, company: null, campaign: null, phone: null },
  ...o,
});

// 14:40 in Belgrade (UTC+2).
const base = { now: new Date("2026-10-07T12:40:00Z"), today: "2026-10-07", tz: "Europe/Belgrade" };

describe("planDay", () => {
  it("keeps hundreds of cold calls in one queue and puts timed work on the clock", () => {
    const calls = Array.from({ length: 500 }, (_, i) => task(`call-${i}`));
    const plan = planDay({
      ...base,
      open: [
        ...calls,
        task("demo", { type: "sales_call", dueTime: "17:30" }),
        task("callback", { dueTime: "16:00" }),
        task("follow", { type: "follow_up", priority: "high" }),
        task("note", { type: "other", lead: null, note: "Plan tomorrow" }),
      ],
    });
    expect(plan.queue).toHaveLength(500);
    expect(plan.scheduled.map((t) => t.id)).toEqual(["callback", "demo"]);
    expect(plan.other.map((t) => t.id)).toEqual(["note"]);
    expect(plan.next?.id).toBe("follow");
  });

  it("puts late work first, then what's due within half an hour", () => {
    const late = planDay({ ...base, open: [task("old", { dueDate: new Date("2026-10-06T00:00:00Z") }), task("soon", { dueTime: "15:00" })] });
    expect(late.next?.id).toBe("old");
    const soon = planDay({ ...base, open: [task("soon", { dueTime: "15:00" }), task("whenever", { type: "follow_up" })] });
    expect(soon.next?.id).toBe("soon");
  });

  it("takes the queue in order, urgent first, when working through it", () => {
    const plan = planDay({ ...base, queueMode: true, open: [task("a"), task("b", { priority: "urgent" }), task("meeting", { type: "sales_call", dueTime: "14:50" })] });
    expect(plan.next?.id).toBe("b");
    expect(plan.queue.map((t) => t.id)).toEqual(["a"]);
    expect(plan.scheduled.map((t) => t.id)).toEqual(["meeting"]);
  });
});
