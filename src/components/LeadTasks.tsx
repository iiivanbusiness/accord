"use client";

import { useState, useTransition } from "react";
import TaskFields, { todayLocal, viewerTimeZone, type TaskDraft } from "@/components/TaskFields";
import { formatTaskDue, TASK_PRIORITY_CHIP, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_TYPE_LABEL } from "@/lib/tasks";
import type { TaskInput } from "@/app/(app)/leads/task-actions";

export type LeadTask = {
  id: string;
  type: string;
  dueDate: string; // ISO
  dueTime: string | null;
  priority: string;
  status: string;
  note: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
};

const STATUS_CHIP: Record<string, string> = { done: "chip-success", skipped: "chip-neutral" };

export default function LeadTasks({
  tasks,
  userId,
  canAssign,
  assignees,
  createAction,
  statusAction,
  deleteAction,
}: {
  tasks: LeadTask[];
  userId: string;
  canAssign: boolean;
  assignees: { id: string; name: string }[];
  createAction: (input: TaskInput) => Promise<void>;
  statusAction: (taskId: string, status: "open" | "done" | "skipped") => Promise<void>;
  deleteAction: (taskId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const blank = (): TaskDraft => ({ assigneeId: canAssign ? "" : userId, type: "cold_call", dueDate: todayLocal(), dueTime: "", priority: "normal", note: "" });
  const [draft, setDraft] = useState<TaskDraft>(blank);

  const open = tasks.filter((t) => t.status === "open");
  const closed = tasks.filter((t) => t.status !== "open");

  function run(taskId: string, fn: () => Promise<void>) {
    setError(null);
    setBusyId(taskId);
    startTransition(async () => {
      try {
        // The action's revalidatePath sends the refreshed list back in the
        // same response, so there's nothing else to fetch here.
        await fn();
      } catch {
        setError("Couldn't update that task. Try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (canAssign && !draft.assigneeId) return setError("Pick who it's for.");
    startTransition(async () => {
      try {
        await createAction({ ...draft, timezone: viewerTimeZone() });
        // After an await, updates need their own transition to land
        // together with the refreshed list rather than before it.
        startTransition(() => {
          setDraft(blank());
          setAdding(false);
        });
      } catch {
        setError("Couldn't add that task. Try again.");
      }
    });
  }

  const row = (t: LeadTask) => {
    const mine = t.assigneeId === userId;
    const canChange = mine || canAssign;
    const busy = busyId === t.id;
    const priorityChip = TASK_PRIORITY_CHIP[t.priority];
    return (
      <div key={t.id} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: "var(--hairline-soft)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium" style={t.status === "open" ? undefined : { color: "var(--ink-muted)", textDecoration: t.status === "done" ? "line-through" : undefined }}>
              {TASK_TYPE_LABEL[t.type] ?? t.type}
            </div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {formatTaskDue(t.dueDate, t.dueTime)} · {mine ? "You" : (t.assigneeName ?? "Unassigned")}
            </div>
          </div>
          <div className="flex flex-none flex-wrap justify-end gap-1">
            {t.status !== "open" && <span className={`chip ${STATUS_CHIP[t.status] ?? "chip-neutral"}`}>{TASK_STATUS_LABEL[t.status] ?? t.status}</span>}
            {t.status === "open" && priorityChip && <span className={`chip ${priorityChip}`}>{TASK_PRIORITY_LABEL[t.priority]}</span>}
          </div>
        </div>
        {t.note && <div className="break-words text-[12.5px]">{t.note}</div>}
        {canChange && (
          <div className="flex flex-wrap gap-1.5">
            {t.status === "open" ? (
              <>
                <button type="button" disabled={pending} onClick={() => run(t.id, () => statusAction(t.id, "done"))} className="btn btn-primary btn-sm">
                  {busy ? "Saving…" : "Done"}
                </button>
                <button type="button" disabled={pending} onClick={() => run(t.id, () => statusAction(t.id, "skipped"))} className="btn btn-secondary btn-sm">
                  Skip
                </button>
              </>
            ) : (
              <button type="button" disabled={pending} onClick={() => run(t.id, () => statusAction(t.id, "open"))} className="btn btn-secondary btn-sm">
                {busy ? "Saving…" : "Reopen"}
              </button>
            )}
            {canAssign &&
              (confirmingId === t.id ? (
                <span className="flex items-center gap-2 px-1">
                  <button type="button" disabled={pending} onClick={() => run(t.id, () => deleteAction(t.id))} className="text-[12px] font-medium" style={{ color: "#c0392b" }}>
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" disabled={pending} onClick={() => setConfirmingId(t.id)} className="px-1 text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                  Delete
                </button>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px] font-medium">Tasks</div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary btn-sm">
            + Add task
          </button>
        )}
      </div>

      {error && <div className="chip chip-warn w-full justify-start px-3 py-2 text-[12.5px]">{error}</div>}

      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-[12px] border p-3.5" style={{ borderColor: "var(--hairline)" }}>
          <TaskFields draft={draft} setDraft={setDraft} assignees={canAssign ? assignees : null} disabled={pending} compact />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add task"}</button>
            <button type="button" disabled={pending} onClick={() => { setAdding(false); setDraft(blank()); setError(null); }} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {open.length === 0 && !adding && (
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{tasks.length === 0 ? "No tasks yet." : "No open tasks."}</div>
      )}
      {open.length > 0 && <div className="flex flex-col gap-3">{open.map(row)}</div>}
      {closed.length > 0 && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer select-none" style={{ color: "var(--ink-muted)" }}>
            {closed.length} finished
          </summary>
          <div className="mt-3 flex flex-col gap-3">{closed.map(row)}</div>
        </details>
      )}
    </div>
  );
}
