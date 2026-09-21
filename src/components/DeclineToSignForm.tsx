"use client";

import { useState, useTransition } from "react";

export default function DeclineToSignForm({
  contractId,
  token,
  declineAction,
}: {
  contractId: string;
  token: string;
  declineAction: (contractId: string, token: string, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await declineAction(contractId, token, formData);
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
      <textarea name="reason" rows={2} placeholder="What needs to change? (optional)" className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
      <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm w-fit">
        {isPending ? "Sending…" : "Decline to sign"}
      </button>
    </form>
  );
}
