"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// On a call that was set aside (too short, or one voice): run it through
// the model after all, for when the speaker split got it wrong.
export default function ProcessAnywayButton({ action }: { action: () => Promise<void> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await action();
              router.push("/calls");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't start processing");
            }
          })
        }
        className="text-[12px] font-medium"
        style={{ color: "var(--accent-blue)" }}
      >
        {pending ? "Starting…" : "Process anyway"}
      </button>
      {error && <span className="text-[12px]" style={{ color: "var(--warn, #b45309)" }}>{error}</span>}
    </span>
  );
}
