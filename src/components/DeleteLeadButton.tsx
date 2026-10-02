"use client";

import { useState, useTransition } from "react";

// "Delete lead" at the bottom of a lead's page, for managers. Asks once
// inline before it goes; the action then sends them back to the list.
export default function DeleteLeadButton({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start px-1 text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
        Delete lead
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border p-3.5 text-[12.5px]" style={{ borderColor: "var(--hairline)" }}>
      <div>Delete this lead, its tasks and call notes? This can&apos;t be undone.</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => startTransition(() => action())} className="btn btn-sm" style={{ background: "#c0392b", color: "#fff" }}>
          {pending ? "Deleting…" : "Delete lead"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
