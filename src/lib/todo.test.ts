import { describe, expect, it } from "vitest";
import { buildTodo, type TodoCall, type TodoTask } from "./todo";

const me = { id: "u1", name: "Ivan" };
const mia = { id: "u2", name: "Mia" };
const lead = (id: string) => ({ id, name: id, company: null, campaign: null, phone: null });
const task = (id: string, o: Partial<TodoTask> = {}): TodoTask => ({
  id,
  type: "cold_call",
  status: "open",
  dueDate: new Date("2026-10-07T00:00:00Z"),
  dueTime: null,
  priority: "normal",
  note: null,
  completedAt: null,
  assignee: me,
  createdBy: me,
  lead: lead(`lead-${id}`),
  ...o,
});
const call = (id: string, o: Partial<TodoCall> = {}): TodoCall => ({ id, mode: "cold", status: "processed", outcome: "interested", startedAt: new Date("2026-10-07T08:00:00Z"), user: me, lead: lead(`lead-${id}`), dealId: null, ...o });

// 14:40 in Belgrade (UTC+2).
const base = { now: new Date("2026-10-07T12:40:00Z"), today: "2026-10-07", tz: "Europe/Belgrade", meId: "u1", events: [] };

describe("buildTodo", () => {
  it("puts late work first, then the day by the clock around now", () => {
    const todo = buildTodo({
      ...base,
      tasks: [
        task("late", { dueDate: new Date("2026-10-06T00:00:00Z"), dueTime: "16:00" }),
        task("missed", { dueTime: "13:00" }),
        task("later", { dueTime: "17:30" }),
        task("soon", { dueTime: "15:00" }),
        task("whenever", { priority: "high" }),
        task("done", { status: "done", completedAt: new Date("2026-10-07T07:37:00Z"), lead: lead("lead-hannah") }),
      ],
      calls: [call("hannah", { lead: lead("lead-hannah"), outcome: "follow_up" }), call("other", { user: mia, startedAt: new Date("2026-10-07T08:50:00Z") })],
    });
    expect(todo.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(todo.done.map((i) => (i.kind === "task" ? i.task.id : i.kind === "call" ? i.call.id : i.event.id))).toEqual(["done", "other", "missed"]);
    expect(todo.done[0]).toMatchObject({ time: "09:37", outcome: "follow_up" });
    expect(todo.done[2]).toMatchObject({ late: true, time: "13:00" });
    expect(todo.coming.map((i) => (i.kind === "task" ? i.task.id : ""))).toEqual(["soon", "later"]);
    expect(todo.anytime.map((t) => t.id)).toEqual(["whenever"]);
    expect(todo.nextId).toBe("late");
  });

  it("picks the viewer's own next task, never a teammate's", () => {
    const todo = buildTodo({ ...base, tasks: [task("theirs", { assignee: mia, dueTime: "14:50" }), task("mine", { dueTime: "16:00" })], calls: [] });
    expect(todo.nextId).toBe("mine");
  });
});
