"use client";

import { useState, useTransition } from "react";

export default function SendToDocusignButton({
  dealId,
  sendAction,
}: {
  dealId: string;
  sendAction: (dealId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await sendAction(dealId);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send to DocuSign");
      }
    });
  }

  if (sent) {
    return (
      <div className="card flex items-center gap-2 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--success)" }}>
        ✓ Sent to DocuSign
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-5">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}
      <button type="button" disabled={isPending} onClick={handleClick} className="btn btn-primary w-full justify-center">
        {isPending ? "Sending…" : "Send via DocuSign now"}
      </button>
      <span className="text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
        Sends immediately with a standard message — client signs on DocuSign, right while you&apos;re still on the call.
      </span>
    </div>
  );
}
