"use client";

import { useState, useTransition } from "react";

type LibraryItem = { id: string; title: string; body: string };

export default function ClauseLibraryManager({
  items,
  createAction,
  updateAction,
  deleteAction,
}: {
  items: LibraryItem[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (itemId: string, formData: FormData) => Promise<void>;
  deleteAction: (itemId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setEditingId(null);
        setAdding(false);
        setConfirmingDeleteId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="px-5 py-2">
      {error && (
        <div className="mb-2 mt-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="py-4 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          No saved clauses yet — add one below, then insert it into any template.
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
          {editingId === item.id ? (
            <form
              action={(formData) => run(() => updateAction(item.id, formData))}
              className="rounded-[10px] p-3.5"
              style={{ background: "var(--surface-2)" }}
            >
              <input name="title" defaultValue={item.title} className="input mb-2" style={{ fontSize: "13px", padding: "8px 11px" }} />
              <textarea name="body" defaultValue={item.body} rows={3} className="input w-full" style={{ fontSize: "13px", padding: "8px 11px" }} />
              <div className="mt-2.5 flex gap-2">
                <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{item.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{item.body}</div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <button type="button" onClick={() => setEditingId(item.id)} className="text-[12px] font-medium" style={{ color: "var(--accent-blue)" }}>
                    Edit
                  </button>
                  {confirmingDeleteId === item.id ? (
                    <span className="flex items-center gap-2">
                      <button type="button" disabled={isPending} onClick={() => run(() => deleteAction(item.id))} className="text-[12px] font-medium" style={{ color: "#c0392b" }}>
                        Confirm
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)} className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmingDeleteId(item.id)} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <form
          action={(formData) => run(() => createAction(formData))}
          className="my-3 rounded-[10px] p-3.5"
          style={{ background: "var(--surface-2)" }}
        >
          <input name="title" placeholder="Clause title, e.g. Confidentiality" required className="input mb-2" style={{ fontSize: "13px", padding: "8px 11px" }} />
          <textarea name="body" placeholder="Clause text…" rows={3} required className="input w-full" style={{ fontSize: "13px", padding: "8px 11px" }} />
          <div className="mt-2.5 flex gap-2">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">Save clause</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setError(null); }} className="my-3 text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
          + Add clause
        </button>
      )}
    </div>
  );
}
