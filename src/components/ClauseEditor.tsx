"use client";

import { useState } from "react";

type Clause = { title: string; body: string };
type LibraryItem = { id: string; title: string; body: string };

export default function ClauseEditor({ initialClauses, libraryClauses }: { initialClauses?: Clause[]; libraryClauses?: LibraryItem[] }) {
  const [clauses, setClauses] = useState<Clause[]>(
    initialClauses && initialClauses.length > 0
      ? initialClauses
      : [{ title: "Services", body: "Agency will provide {service} for {clientName}." }]
  );
  const [libraryPick, setLibraryPick] = useState("");

  function update(i: number, key: keyof Clause, value: string) {
    setClauses((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  }
  function addClause() {
    setClauses((prev) => [...prev, { title: "", body: "" }]);
  }
  function removeClause(i: number) {
    setClauses((prev) => prev.filter((_, idx) => idx !== i));
  }
  function insertFromLibrary() {
    const item = libraryClauses?.find((l) => l.id === libraryPick);
    if (!item) return;
    // A plain copy, not a reference — editing this clause afterward, or
    // updating the library item later, never touches the other.
    setClauses((prev) => [...prev, { title: item.title, body: item.body }]);
    setLibraryPick("");
  }

  return (
    <div>
      <input type="hidden" name="clausesJson" value={JSON.stringify(clauses)} />
      <div className="mb-1.5 text-[13px] font-medium">Clauses</div>
      <div className="mb-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
        Use {"{fieldKey}"} placeholders (e.g. {"{clientName}"}, {"{fee}"}, {"{startDate}"}) — they&apos;re filled from the call automatically.
      </div>
      <div className="flex flex-col gap-3">
        {clauses.map((clause, i) => (
          <div key={i} className="rounded-[10px] p-3" style={{ border: "1px solid var(--hairline)", background: "var(--canvas)" }}>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={clause.title}
                onChange={(e) => update(i, "title", e.target.value)}
                placeholder="Clause title"
                className="input flex-1"
                style={{ fontSize: "13px", padding: "7px 10px" }}
              />
              <button type="button" onClick={() => removeClause(i)} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                Remove
              </button>
            </div>
            <textarea
              value={clause.body}
              onChange={(e) => update(i, "body", e.target.value)}
              placeholder="Clause text…"
              rows={2}
              className="input w-full"
              style={{ fontSize: "13px", padding: "8px 10px", resize: "vertical" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addClause} className="btn btn-secondary btn-sm">
          + Add clause
        </button>
        {libraryClauses && libraryClauses.length > 0 && (
          <>
            <select
              value={libraryPick}
              onChange={(e) => setLibraryPick(e.target.value)}
              className="input"
              style={{ fontSize: "12.5px", padding: "6px 9px", width: "auto" }}
            >
              <option value="">Insert from library…</option>
              {libraryClauses.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <button type="button" onClick={insertFromLibrary} disabled={!libraryPick} className="btn btn-secondary btn-sm">
              Insert
            </button>
          </>
        )}
      </div>
    </div>
  );
}
