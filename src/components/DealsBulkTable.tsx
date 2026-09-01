"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type Row = {
  id: string;
  clientName: string;
  service: string;
  feeDisplay: string;
  statusLabel: string;
  statusChip: string;
  updatedAgo: string;
  canRemind: boolean;
  canSend: boolean;
};

export default function DealsBulkTable({
  rows,
  remindAction,
  sendAction,
}: {
  rows: Row[];
  remindAction: (dealIds: string[]) => Promise<{ sent: number; skipped: number }>;
  sendAction: (dealIds: string[]) => Promise<{ sent: number; skipped: number }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleForRemind = rows.filter((r) => selected.has(r.id) && r.canRemind).length;
  const eligibleForSend = rows.filter((r) => selected.has(r.id) && r.canSend).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function run(action: (ids: string[]) => Promise<{ sent: number; skipped: number }>, verb: string) {
    setMessage(null);
    const ids = [...selected];
    startTransition(async () => {
      try {
        const result = await action(ids);
        setMessage(`${verb}: ${result.sent} sent${result.skipped > 0 ? `, ${result.skipped} skipped (not eligible)` : ""}.`);
        setSelected(new Set());
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}>
          <span className="text-[13px] font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending || eligibleForRemind === 0}
              onClick={() => run(remindAction, "Reminders")}
              className="btn btn-secondary btn-sm"
              title={eligibleForRemind === 0 ? "None of the selected deals are sent-but-unsigned" : undefined}
            >
              Send reminder ({eligibleForRemind})
            </button>
            <button
              type="button"
              disabled={isPending || eligibleForSend === 0}
              onClick={() => run(sendAction, "Sends")}
              className="btn btn-secondary btn-sm"
              title={eligibleForSend === 0 ? "None of the selected deals have a draft contract ready to send" : undefined}
            >
              Send to client ({eligibleForSend})
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              Clear
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="border-b px-5 py-2.5 text-[12.5px]" style={{ borderColor: "var(--hairline)", color: "var(--ink-muted)" }}>
          {message}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b px-5 py-3.5" style={{ borderColor: "var(--hairline)", width: 36 }}>
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
              </th>
              {["Client", "Value", "Status", "Updated"].map((h) => (
                <th
                  key={h}
                  className="border-b px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="row-hover transition-colors">
                <td className="border-b px-5 py-4" style={{ borderColor: "var(--hairline-soft)" }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                </td>
                <td className="border-b px-5 py-4" style={{ borderColor: "var(--hairline-soft)" }}>
                  <Link href={`/deals/${row.id}`} className="flex flex-col gap-0.5" style={{ color: "inherit" }}>
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{row.clientName}</span>
                    <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{row.service}</span>
                  </Link>
                </td>
                <td className="font-mono-tab border-b px-5 py-4 font-medium" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink)" }}>
                  {row.feeDisplay}
                </td>
                <td className="border-b px-5 py-4" style={{ borderColor: "var(--hairline-soft)" }}>
                  <span className={`chip ${row.statusChip}`}>
                    <span className="chip-dot" />
                    {row.statusLabel}
                  </span>
                </td>
                <td className="border-b px-5 py-4 text-[13px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
                  {row.updatedAgo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
