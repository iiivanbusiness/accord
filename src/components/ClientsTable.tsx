"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  dealsCount: number;
  lastActivityAgo: string;
  lastActivityAt: number;
  riskLevel: "high" | "watch" | "none";
  riskLabel: string | null;
};

type SortKey = "name" | "company" | "dealsCount" | "lastActivityAt";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Client" },
  { key: "company", label: "Company" },
  { key: "dealsCount", label: "Deals" },
  { key: "lastActivityAt", label: "Last activity" },
];

const RISK_CHIP: Record<string, string> = { high: "chip-warn", watch: "chip-neutral" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

export default function ClientsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("lastActivityAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
      setSortDir(key === "name" || key === "company" ? "asc" : "desc");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card px-5 py-12 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
        No clients match that search.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="max-h-[calc(100vh-260px)] overflow-auto"
        style={{
          // Same right-edge cue as DealsBulkTable — the Phone/Deals/Last
          // activity columns can run past a narrow viewport, and this
          // fades that edge instead of hard-clipping it.
          maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
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
              <th className="sticky top-0 z-10 whitespace-nowrap border-b px-5 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)", background: "var(--surface-1)" }}>
                Email
              </th>
              <th className="sticky top-0 z-10 whitespace-nowrap border-b px-5 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)", background: "var(--surface-1)" }}>
                Phone
              </th>
              <th className="sticky top-0 z-10 whitespace-nowrap border-b px-5 py-3 text-left text-[11.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)", background: "var(--surface-1)" }}>
                Risk
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="row-hover transition-colors">
                <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                  <Link href={`/clients/${row.id}`} className="flex items-center gap-2.5" style={{ color: "inherit" }}>
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-semibold"
                      style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}
                    >
                      {initials(row.name)}
                    </span>
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{row.name}</span>
                  </Link>
                </td>
                <td className="border-b px-5 py-3 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>{row.company}</td>
                <td className="font-mono-tab border-b px-5 py-3 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>{row.dealsCount}</td>
                <td className="border-b px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>{row.lastActivityAgo}</td>
                <td className="border-b px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>{row.email ?? "—"}</td>
                <td className="font-mono-tab border-b px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>{row.phone ?? "—"}</td>
                <td className="border-b px-5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
                  {row.riskLevel !== "none" ? (
                    <span className={`chip ${RISK_CHIP[row.riskLevel]}`} style={{ fontSize: 11 }}>{row.riskLabel}</span>
                  ) : (
                    <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
