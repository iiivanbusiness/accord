"use client";

import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, TASK_TYPE_LABEL, TASK_TYPES } from "@/lib/tasks";

export type TaskDraft = { assigneeId: string; type: string; dueDate: string; dueTime: string; priority: string; note: string };

// Today's date in the viewer's own timezone, as YYYY-MM-DD for a date input.
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? "col-span-full" : ""}`}>
      <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

// The inputs for a task, shared by bulk "Assign" on the lead list and
// "Add task" on a lead. assignees is null when the viewer can only give
// tasks to themselves. compact drops to one column where the lead page
// puts it in the narrow sidebar (lg and up).
export default function TaskFields({
  draft,
  setDraft,
  assignees,
  disabled,
  compact,
}: {
  draft: TaskDraft;
  setDraft: (d: TaskDraft) => void;
  assignees: { id: string; name: string }[] | null;
  disabled?: boolean;
  compact?: boolean;
}) {
  const set = (k: keyof TaskDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${compact ? "lg:grid-cols-1" : ""}`}>
      {assignees && (
        <Field label="Assign to">
          <select value={draft.assigneeId} onChange={set("assigneeId")} className="input" disabled={disabled} required>
            <option value="" disabled>
              Pick a teammate
            </option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Task">
        <select value={draft.type} onChange={set("type")} className="input" disabled={disabled}>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>{TASK_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </Field>
      <Field label="Day">
        <input type="date" value={draft.dueDate} onChange={set("dueDate")} className="input" disabled={disabled} required />
      </Field>
      <Field label="Time (optional)">
        <input type="time" value={draft.dueTime} onChange={set("dueTime")} className="input" disabled={disabled} />
      </Field>
      <Field label="Priority">
        <select value={draft.priority} onChange={set("priority")} className="input" disabled={disabled}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" wide>
        <textarea value={draft.note} onChange={set("note")} rows={2} maxLength={1000} className="input" disabled={disabled} placeholder="Anything they should know before the call" />
      </Field>
    </div>
  );
}
