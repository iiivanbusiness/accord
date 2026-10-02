"use client";

import Link from "next/link";
import { useTransition } from "react";
import { TASK_PRIORITY_CHIP, TASK_PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/lib/tasks";

export type TodayTask = {
  id: string;
  type: string;
  status: string;
  when: string; // "10:30", "Thu, Oct 1", or ""
  priority: string;
  note: string | null;
  lead: { id: string; name: string; detail: string; phone: string | null; phoneLabel: string | null } | null;
};

// One task on the Today page: who to call, a Call button that dials from
// this device, and Done / Skip (or Reopen, in the finished list).
export default function TodayTaskRow({
  task,
  overdue,
  showType,
  statusAction,
}: {
  task: TodayTask;
  overdue?: boolean;
  showType?: boolean;
  statusAction: (taskId: string, status: "open" | "done" | "skipped") => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const set = (status: "open" | "done" | "skipped") => startTransition(() => statusAction(task.id, status));
  const priorityChip = TASK_PRIORITY_CHIP[task.priority];
  const finished = task.status !== "open";
  const callFirst = task.type === "cold_call" || task.type === "sales_call";

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5" style={pending ? { opacity: 0.6 } : undefined}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.lead ? (
            <Link href={`/leads/${task.lead.id}`} className="truncate text-[14px] font-medium" style={{ color: "var(--ink)", textDecoration: task.status === "done" ? "line-through" : undefined }}>
              {task.lead.name}
            </Link>
          ) : (
            <span className="text-[14px] font-medium">{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
          )}
          {!finished && priorityChip && <span className={`chip ${priorityChip}`}>{TASK_PRIORITY_LABEL[task.priority]}</span>}
          {finished && <span className={`chip ${task.status === "done" ? "chip-success" : "chip-neutral"}`}>{task.status === "done" ? "Done" : "Skipped"}</span>}
        </div>
        <div className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          {[
            showType && task.lead ? (TASK_TYPE_LABEL[task.type] ?? task.type) : null,
            task.when ? (overdue ? `Due ${task.when}` : task.when) : null,
            task.lead?.detail || null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {task.note && <div className="mt-1 break-words text-[12.5px]">{task.note}</div>}
      </div>
      <div className="flex flex-none flex-wrap items-center gap-1.5">
        {finished ? (
          <button type="button" disabled={pending} onClick={() => set("open")} className="btn btn-secondary btn-sm">
            Reopen
          </button>
        ) : (
          <>
            {task.lead?.phone && (
              <a href={`tel:${task.lead.phone}`} className={`btn btn-sm ${callFirst ? "btn-primary" : "btn-secondary"}`} title={task.lead.phoneLabel ?? undefined}>
                Call
              </a>
            )}
            <button type="button" disabled={pending} onClick={() => set("done")} className={`btn btn-sm ${task.lead?.phone && callFirst ? "btn-secondary" : "btn-primary"}`}>
              Done
            </button>
            <button type="button" disabled={pending} onClick={() => set("skipped")} className="btn btn-ghost btn-sm">
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
