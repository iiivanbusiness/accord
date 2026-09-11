"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

type Row = {
  id: string;
  clientName: string;
  service: string;
  feeDisplay: string;
  feeValue: number;
  statusLabel: string;
  statusChip: string;
  updatedAgo: string;
  updatedAt: number;
  ownerName: string | null;
  isStale: boolean;
  canRemind: boolean;
  canSend: boolean;
};

type SortKey = "clientName" | "feeValue" | "statusLabel" | "updatedAt" | "ownerName";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "clientName", label: "Client" },
  { key: "feeValue", label: "Value" },
  { key: "statusLabel", label: "Status" },
  { key: "updatedAt", label: "Updated" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

export default function DealsBulkTable({
  rows,
  remindAction,
  sendAction,
  showOwnerColumn = false,
}: {
  rows: Row[];
  remindAction: (dealIds: string[]) => Promise<{ sent: number; skipped: number }>;
  sendAction: (dealIds: string[]) => Promise<{ sent: number; skipped: number }>;
  showOwnerColumn?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const eligibleForRemind = rows.filter((r) => selected.has(r.id) && r.canRemind).length;
  const eligibleForSend = rows.filter((r) => selected.has(r.id) && r.canSend).length;

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "clientName" || key === "statusLabel" ? "asc" : "desc");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === sortedRows.length ? new Set() : new Set(sortedRows.map((r) => r.id))));
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
    <div className="glass-card glass-card-solid card-hover overflow-hidden">
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
      <div
        className="max-h-[calc(100vh-260px)] overflow-auto"
        style={{
          // On narrow viewports the table is wider than its container and
          // scrolls sideways — without a cue, the Status column just looks
          // clipped off rather than "scroll to see more" (the same issue
          // the deal board's columns had). Fades the right edge toward
          // transparent so a cut-off column reads as scrollable, not broken.
          maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky top-0 z-10 border-b px-5 py-3"
                style={{ borderColor: "var(--hairline)", width: 36, background: "var(--surface-1)" }}
              >
                <input type="checkbox" checked={sortedRows.length > 0 && selected.size === sortedRows.length} onChange={toggleAll} />
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b px-5 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide"
                  style={{ color: sortKey === c.key ? "var(--ink)" : "var(--ink-muted)", borderColor: "var(--hairline)", background: "var(--surface-1)" }}
                >
                  {c.label}
                  {sortKey === c.key && <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
              {showOwnerColumn && (
                <th
                  onClick={() => handleSort("ownerName")}
                  className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b px-5 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide"
                  style={{ color: sortKey === "ownerName" ? "var(--ink)" : "var(--ink-muted)", borderColor: "var(--hairline)", background: "var(--surface-1)" }}
                >
                  Owner
                  {sortKey === "ownerName" && <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="row-hover transition-colors">
                <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                </td>
                <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                  <Link href={`/deals/${row.id}`} className="flex items-center gap-2" style={{ color: "inherit" }}>
                    {row.isStale && (
                      <span
                        title="No activity in 7+ days"
                        className="h-1.5 w-1.5 flex-none rounded-full"
                        style={{ background: "var(--warn)" }}
                      />
                    )}
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium" style={{ color: "var(--ink)" }}>{row.clientName}</span>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{row.service}</span>
                    </span>
                  </Link>
                </td>
                <td className="font-mono-tab border-b px-5 py-3 font-semibold" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink)" }}>
                  {row.feeDisplay}
                </td>
                <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                  <span className={`chip ${row.statusChip}`}>
                    <span className="chip-dot" />
                    {row.statusLabel}
                  </span>
                </td>
                <td className="border-b px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
                  {row.updatedAgo}
                </td>
                {showOwnerColumn && (
                  <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                    {row.ownerName ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold"
                          style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}
                        >
                          {initials(row.ownerName)}
                        </span>
                        <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{row.ownerName}</span>
                      </span>
                    ) : (
                      <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={showOwnerColumn ? 6 : 5} className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
                  No deals match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
