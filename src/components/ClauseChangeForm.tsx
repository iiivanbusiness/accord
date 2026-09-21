"use client";

import { useState, useTransition } from "react";

// Same reasoning as SignForm: requestClauseChange threw for an empty
// comment or a rate limit, and this form had no client-side catch — an
// external client hitting either would see a full page crash instead of a
// message telling them what to fix.
export default function ClauseChangeForm({
  contractId,
  clauseTitle,
  requestChangeAction,
}: {
  contractId: string;
  clauseTitle: string;
  requestChangeAction: (contractId: string, clauseTitle: string, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestChangeAction(contractId, clauseTitle, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="mt-2.5 flex flex-col gap-2 rounded-[10px] p-3.5" style={{ background: "var(--surface-2)" }}>
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12px]" style={{ background: "var(--surface-1)", color: "#c0392b" }}>
          {error}
        </div>
      )}
      <input name="fromName" placeholder="Your name (optional)" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
      <textarea name="comment" required rows={2} placeholder="What would you like changed here?" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
      <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm w-fit">
        {isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
