"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import TaskFields, { todayLocal, viewerTimeZone, type TaskDraft } from "@/components/TaskFields";

export type LeadRow = {
  id: string;
  name: string;
  subtitle: string;
  secondary: string;
  company: string | null;
  campaign: string | null;
  stageLabel: string;
  stageChip: string;
  interest: string;
  owner: string;
  next: string;
  updated: string;
};

type AssignInput = TaskDraft & { timezone: string; leadIds: string[]; makeOwner: boolean };

// Columns drop out as the window narrows so the table never runs past the
// card; below md the list switches to stacked rows instead.
const SHOW = {
  company: "hidden lg:table-cell",
  owner: "hidden min-[1400px]:table-cell",
  next: "hidden xl:table-cell",
  updated: "hidden 2xl:table-cell",
};

export default function LeadsTable({
  rows,
  showOwner,
  canAssign,
  assignees,
  assignAction,
  deleteAction,
}: {
  rows: LeadRow[];
  showOwner: boolean;
  canAssign: boolean;
  assignees: { id: string; name: string }[];
  assignAction: (input: AssignInput) => Promise<{ created: number }>;
  deleteAction?: (leadIds: string[]) => Promise<{ deleted: number }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => {
    setNotice(null);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    setNotice(null);
    setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const check = (id: string, label: string) =>
    canAssign ? (
      <input type="checkbox" className="h-4 w-4 flex-none" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={`Select ${label}`} />
    ) : null;

  return (
    <>
      {notice && (
        <div className="chip chip-success mb-3 w-full justify-start px-4 py-2.5 text-[12.5px]" role="status">{notice}</div>
      )}

      {/* Phone: stacked rows */}
      <div className="card divide-y overflow-hidden md:hidden" style={{ borderColor: "var(--hairline)" }}>
        {canAssign && (
          <label className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
            <input type="checkbox" className="h-4 w-4" checked={allOnPage} onChange={toggleAll} aria-label="Select all leads on this page" />
            Select all
          </label>
        )}
        {rows.map((lead) => (
          <div key={lead.id} className="flex items-start gap-3 px-4 py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
            {canAssign && <div className="pt-[3px]">{check(lead.id, lead.name)}</div>}
            <Link href={`/leads/${lead.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{lead.name}</div>
                  <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{lead.subtitle || "No details yet"}</div>
                </div>
                <span className={`chip flex-none ${lead.stageChip}`}>{lead.stageLabel}</span>
              </div>
              {lead.next && <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>Next: {lead.next}</div>}
            </Link>
          </div>
        ))}
      </div>

      {/* Computer: table */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {canAssign && (
                  <th className="w-10 border-b py-3 pl-4" style={{ borderColor: "var(--hairline)" }}>
                    <input type="checkbox" className="h-4 w-4" checked={allOnPage} onChange={toggleAll} aria-label="Select all leads on this page" />
                  </th>
                )}
                {[
                  { label: "Lead", show: "" },
                  { label: "Company", show: SHOW.company },
                  { label: "Stage", show: "" },
                  { label: "Interest", show: "" },
                  ...(showOwner ? [{ label: "Owner", show: SHOW.owner }] : []),
                  { label: "Next step", show: SHOW.next },
                  { label: "Updated", show: SHOW.updated },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={`whitespace-nowrap border-b px-4 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide ${col.show}`}
                    style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const cell = "border-b px-4 py-3 text-[13px]";
                const border = { borderColor: "var(--hairline-soft)" };
                const muted = { ...border, color: "var(--ink-muted)" };
                return (
                  <tr key={lead.id} className="row-hover transition-colors">
                    {canAssign && (
                      <td className="border-b py-3 pl-4" style={border}>
                        {check(lead.id, lead.name)}
                      </td>
                    )}
                    <td className={cell} style={border}>
                      <Link href={`/leads/${lead.id}`} className="block max-w-[200px]">
                        <div className="truncate font-medium" style={{ color: "var(--ink)" }} title={lead.name}>{lead.name}</div>
                        <div className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>{lead.secondary || " "}</div>
                      </Link>
                    </td>
                    <td className={`${cell} ${SHOW.company}`} style={muted}>
                      <div className="max-w-[160px] truncate" title={lead.company ?? undefined}>{lead.company ?? "-"}</div>
                      {lead.campaign && <div className="max-w-[160px] truncate text-[12px]" title={`Campaign: ${lead.campaign}`}>{lead.campaign}</div>}
                    </td>
                    <td className={cell} style={border}>
                      <span className={`chip whitespace-nowrap ${lead.stageChip}`}>{lead.stageLabel}</span>
                    </td>
                    <td className={`whitespace-nowrap ${cell}`} style={muted}>{lead.interest}</td>
                    {showOwner && (
                      <td className={`${cell} ${SHOW.owner}`} style={muted}>
                        <div className="max-w-[120px] truncate">{lead.owner}</div>
                      </td>
                    )}
                    <td className={`${cell} ${SHOW.next}`} style={muted}>
                      <div className="max-w-[180px] truncate" title={lead.next}>{lead.next || "-"}</div>
                    </td>
                    <td className={`whitespace-nowrap ${cell} ${SHOW.updated}`} style={muted}>{lead.updated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floats at the bottom so ticking the first box doesn't push the
          list down under the cursor. On phones it sits above the tab bar,
          level with the help button and left of it. */}
      {canAssign && selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-start px-4 md:bottom-6 md:justify-center">
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-full border py-1.5 pl-5 pr-1.5"
            style={{ background: "var(--surface-1)", borderColor: "var(--hairline)", boxShadow: "0 10px 34px rgba(0, 0, 0, 0.18)" }}
            role="region"
            aria-label="Selected leads"
          >
            <span className="whitespace-nowrap text-[13px] font-medium">{selected.size.toLocaleString("en-US")} selected</span>
            <button type="button" onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">Clear</button>
            {deleteAction && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-ghost btn-sm" style={{ color: "#c0392b" }}>Delete</button>
            )}
            <button type="button" onClick={() => setDialog(true)} className="btn btn-primary btn-sm">Assign</button>
          </div>
        </div>
      )}

      {confirmDelete && deleteAction && (
        <DeleteDialog
          count={selected.size}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { deleted } = await deleteAction([...selected]);
            return () => {
              setNotice(`Deleted ${deleted.toLocaleString("en-US")} ${deleted === 1 ? "lead" : "leads"}.`);
              setSelected(new Set());
              setConfirmDelete(false);
            };
          }}
        />
      )}

      {dialog && (
        <AssignDialog
          count={selected.size}
          assignees={assignees}
          onClose={() => setDialog(false)}
          onSubmit={async (draft, makeOwner) => {
            const { created } = await assignAction({ ...draft, timezone: viewerTimeZone(), leadIds: [...selected], makeOwner });
            const who = assignees.find((a) => a.id === draft.assigneeId)?.name ?? "them";
            return () => {
              setNotice(`${created.toLocaleString("en-US")} ${created === 1 ? "task" : "tasks"} assigned to ${who}.`);
              setSelected(new Set());
              setDialog(false);
            };
          }}
        />
      )}
    </>
  );
}

function AssignDialog({
  count,
  assignees,
  onClose,
  onSubmit,
}: {
  count: number;
  assignees: { id: string; name: string }[];
  onClose: () => void;
  // Saves, then returns the UI updates to apply once it has.
  onSubmit: (draft: TaskDraft, makeOwner: boolean) => Promise<() => void>;
}) {
  const [draft, setDraft] = useState<TaskDraft>({ assigneeId: "", type: "cold_call", dueDate: todayLocal(), dueTime: "", priority: "normal", note: "" });
  const [makeOwner, setMakeOwner] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!draft.assigneeId) return setError("Pick who it's for.");
    startTransition(async () => {
      try {
        const done = await onSubmit(draft, makeOwner);
        // After an await, updates need their own transition to land together
        // with the refreshed list (sent back by the action's revalidatePath).
        startTransition(done);
      } catch {
        setError("Couldn't assign those. Try again.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Assign leads"
        className="card flex max-h-[92dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[var(--r-lg)] sm:p-6"
      >
        <div>
          <h2 className="text-[16px] font-medium">Assign {count.toLocaleString("en-US")} {count === 1 ? "lead" : "leads"}</h2>
          <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>One task per lead, on their list for that day.</div>
        </div>
        <TaskFields draft={draft} setDraft={setDraft} assignees={assignees} disabled={pending} />
        <label className="flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" className="mt-[2px] h-4 w-4" checked={makeOwner} onChange={(e) => setMakeOwner(e.target.checked)} disabled={pending} />
          <span>Also make them the owner of {count === 1 ? "this lead" : "these leads"}</span>
        </label>
        {error && <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Assigning…" : "Assign"}</button>
          <button type="button" disabled={pending} onClick={onClose} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: () => Promise<() => void> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const what = `${count.toLocaleString("en-US")} ${count === 1 ? "lead" : "leads"}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }} onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Delete leads" className="card flex w-full max-w-[440px] flex-col gap-4 rounded-b-none p-5 sm:rounded-b-[var(--r-lg)] sm:p-6">
        <div>
          <h2 className="text-[16px] font-medium">Delete {what}?</h2>
          <div className="mt-1 text-[13px]" style={{ color: "var(--ink-muted)" }}>
            Their tasks and call notes are deleted too. Leads that became deals keep their deal and client. This can&apos;t be undone.
          </div>
        </div>
        {error && <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[12.5px]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const done = await onConfirm();
                  startTransition(done);
                } catch {
                  setError("Couldn't delete those. Try again.");
                }
              })
            }
            className="btn"
            style={{ background: "#c0392b", color: "#fff" }}
          >
            {pending ? "Deleting…" : `Delete ${what}`}
          </button>
          <button type="button" disabled={pending} onClick={onClose} className="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
