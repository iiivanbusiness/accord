"use client";

import { useState, useTransition } from "react";
import type { MoveTasksInput } from "@/app/(app)/team/actions";

export type TeamRow = {
  id: string; // a user id, or "unassigned"
  name: string;
  detail: string; // role, "Deactivated", or a note
  open: number;
  overdue: number;
  due: number; // overdue + due today
  done: number;
  calls: number;
  connected: number;
  converted: number;
};

const STATS: { key: keyof TeamRow; label: string }[] = [
  { key: "done", label: "Done" },
  { key: "calls", label: "Calls" },
  { key: "connected", label: "Connected" },
  { key: "converted", label: "Converted" },
];

export default function TeamTable({
  rows,
  recipients,
  moveAction,
}: {
  rows: TeamRow[];
  recipients: { id: string; name: string }[];
  moveAction: (input: MoveTasksInput) => Promise<{ moved: number }>;
}) {
  const [moving, setMoving] = useState<TeamRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const moveButton = (row: TeamRow) => (
    <button
      type="button"
      disabled={row.open === 0}
      onClick={() => {
        setNotice(null);
        setMoving(row);
      }}
      className="btn btn-secondary btn-sm whitespace-nowrap"
      style={row.open === 0 ? { opacity: 0.45 } : undefined}
    >
      Move tasks
    </button>
  );

  const openCell = (row: TeamRow) => (
    <>
      <div className="font-medium tabular-nums">{row.open.toLocaleString("en-US")}</div>
      {row.overdue > 0 && <div className="whitespace-nowrap text-[11.5px]" style={{ color: "var(--warn)" }}>{row.overdue.toLocaleString("en-US")} overdue</div>}
    </>
  );

  return (
    <>
      {notice && (
        <div className="chip chip-success mb-3 w-full justify-start px-4 py-2.5 text-[12.5px]" role="status">{notice}</div>
      )}

      {/* Below lg: one card per person */}
      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <div key={row.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium">{row.name}</div>
                <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>{row.detail}</div>
              </div>
              {moveButton(row)}
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 text-[13px] sm:grid-cols-5">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Open</div>
                {openCell(row)}
              </div>
              {STATS.map((s) => (
                <div key={s.key} className="min-w-0">
                  <div className="truncate text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>{s.label}</div>
                  <div className="font-medium tabular-nums">{(row[s.key] as number).toLocaleString("en-US")}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* lg and up: table */}
      <div className="card hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Teammate", "Open tasks", ...STATS.map((s) => s.label), ""].map((label, i) => (
                  <th
                    key={label || "actions"}
                    className={`whitespace-nowrap border-b px-4 py-3 text-[11.5px] font-medium uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}
                    style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cell = "border-b px-4 py-3 text-[13px] text-right tabular-nums";
                const border = { borderColor: "var(--hairline-soft)" };
                return (
                  <tr key={row.id}>
                    <td className="border-b px-4 py-3 text-[13px]" style={border}>
                      <div className="max-w-[220px] truncate font-medium" title={row.name}>{row.name}</div>
                      <div className="max-w-[220px] truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>{row.detail}</div>
                    </td>
                    <td className={cell} style={border}>{openCell(row)}</td>
                    {STATS.map((s) => (
                      <td key={s.key} className={cell} style={border}>{(row[s.key] as number).toLocaleString("en-US")}</td>
                    ))}
                    <td className="border-b px-4 py-3 text-right" style={border}>{moveButton(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {moving && (
        <MoveDialog
          from={moving}
          recipients={recipients.filter((r) => r.id !== moving.id)}
          onClose={() => setMoving(null)}
          onSubmit={async (toId, scope, makeOwner) => {
            const { moved } = await moveAction({ fromUserId: moving.id, toUserId: toId, scope, makeOwner });
            const to = recipients.find((r) => r.id === toId)?.name ?? "them";
            return () => {
              const what = `${moved.toLocaleString("en-US")} ${moving.id === "unassigned" ? "unassigned " : ""}${moved === 1 ? "task" : "tasks"}`;
              setNotice(moved === 0 ? "There were no open tasks to move." : moving.id === "unassigned" ? `Moved ${what} to ${to}.` : `Moved ${what} from ${moving.name} to ${to}.`);
              setMoving(null);
            };
          }}
        />
      )}
    </>
  );
}

function MoveDialog({
  from,
  recipients,
  onClose,
  onSubmit,
}: {
  from: TeamRow;
  recipients: { id: string; name: string }[];
  onClose: () => void;
  // Saves, then returns the UI updates to apply once it has.
  onSubmit: (toId: string, scope: "all" | "due", makeOwner: boolean) => Promise<() => void>;
}) {
  const [toId, setToId] = useState("");
  const [scope, setScope] = useState<"all" | "due">(from.due > 0 && from.due < from.open ? "due" : "all");
  const [makeOwner, setMakeOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = scope === "all" ? from.open : from.due;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!toId) return setError("Pick who gets them.");
    startTransition(async () => {
      try {
        const done = await onSubmit(toId, scope, makeOwner);
        // After an await, updates need their own transition to land together
        // with the refreshed table (sent back by the action's revalidatePath).
        startTransition(done);
      } catch {
        setError("Couldn't move those tasks. Try again.");
      }
    });
  }

  const option = (value: "all" | "due", label: string, n: number) => (
    <label className="flex items-center gap-2.5 text-[13px]" style={n === 0 ? { opacity: 0.5 } : undefined}>
      <input type="radio" name="scope" className="h-4 w-4" checked={scope === value} onChange={() => setScope(value)} disabled={pending || n === 0} />
      <span>
        {label} <span style={{ color: "var(--ink-muted)" }}>({n.toLocaleString("en-US")})</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Move tasks" className="card flex max-h-[92dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[var(--r-lg)] sm:p-6">
        <div>
          <h2 className="text-[16px] font-medium">{from.id === "unassigned" ? "Move unassigned tasks" : `Move tasks from ${from.name}`}</h2>
          <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Days, times and notes stay as they are.</div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>Move to</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="input" disabled={pending} required>
            <option value="" disabled>
              Pick a teammate
            </option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2">
          {option("all", "All open tasks", from.open)}
          {option("due", "Only overdue and due today", from.due)}
        </div>
        <label className="flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" className="mt-[2px] h-4 w-4" checked={makeOwner} onChange={(e) => setMakeOwner(e.target.checked)} disabled={pending} />
          <span>{from.id === "unassigned" ? "Also make them the owner of these leads, where no one owns them" : `Also make them the owner of ${from.name}'s leads in these tasks`}</span>
        </label>
        {error && <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending || count === 0} className="btn btn-primary">
            {pending ? "Moving…" : `Move ${count.toLocaleString("en-US")} ${count === 1 ? "task" : "tasks"}`}
          </button>
          <button type="button" disabled={pending} onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
