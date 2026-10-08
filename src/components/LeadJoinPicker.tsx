"use client";

import { useEffect, useState, useTransition } from "react";

export type JoinPick = { id: string; name: string; company: string | null; calls: number };

// Find another lead, pick it, then confirm: used for moving a call to the
// right lead and for merging two leads of the same client.
export default function LeadJoinPicker({
  search,
  newOption,
  confirmText,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  search: (q: string) => Promise<JoinPick[]>;
  // Shown above the results, e.g. "+ New lead from this call".
  newOption?: string;
  confirmText: (pick: JoinPick | "new") => string;
  confirmLabel: string;
  onConfirm: (pick: JoinPick | "new") => Promise<void>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  // Results for the term they were searched with, so an older answer never
  // shows as "no match" for what's typed now.
  const [results, setResults] = useState<{ term: string; list: JoinPick[] }>({ term: "", list: [] });
  const [pick, setPick] = useState<JoinPick | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      search(term)
        .then((list) => live && setResults({ term, list }))
        .catch(() => live && setResults({ term, list: [] }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term, search]);
  const searching = term.length >= 2 && results.term !== term;
  const shown = term.length < 2 || searching ? [] : results.list;

  if (pick) {
    return (
      <div className="flex flex-col gap-2.5 rounded-[12px] p-3" style={{ background: "var(--canvas)" }}>
        <div className="text-[13px]">{confirmText(pick)}</div>
        {error && <div className="chip chip-warn w-full justify-start whitespace-normal px-3 py-2 text-[12.5px]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await onConfirm(pick);
                } catch (err) {
                  setError(err instanceof Error && err.message && !err.message.includes("digest") ? `${err.message}.` : "That didn't work. Try again.");
                }
              });
            }}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Working…" : confirmLabel}
          </button>
          <button type="button" disabled={pending} onClick={() => setPick(null)} className="btn btn-ghost btn-sm">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: "var(--canvas)" }}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, company or email"
        aria-label="Find the lead"
        className="input"
        autoComplete="off"
      />
      <div className="flex flex-col overflow-hidden rounded-[10px] border" style={{ background: "var(--surface-1)", borderColor: "var(--hairline)" }}>
        {newOption && (
          <button
            type="button"
            onClick={() => setPick("new")}
            className="block w-full truncate px-3 py-2 text-left text-[13px] font-medium hover:bg-[var(--canvas)]"
            style={{ color: "var(--accent-blue)", borderBottom: shown.length ? "1px solid var(--hairline-soft)" : undefined }}
          >
            {newOption}
          </button>
        )}
        {shown.map((l) => (
          <button key={l.id} type="button" onClick={() => setPick(l)} className="block w-full truncate px-3 py-2 text-left text-[13px] hover:bg-[var(--canvas)]">
            {l.name}
            <span style={{ color: "var(--ink-muted)" }}>
              {l.company ? ` · ${l.company}` : ""} · {l.calls} {l.calls === 1 ? "call" : "calls"}
            </span>
          </button>
        ))}
        {searching && <div className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Searching…</div>}
        {term.length >= 2 && !searching && shown.length === 0 && (
          <div className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No leads match.</div>
        )}
        {term.length < 2 && !newOption && (
          <div className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Type at least 2 letters.</div>
        )}
      </div>
      <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm self-start">
        Cancel
      </button>
    </div>
  );
}
