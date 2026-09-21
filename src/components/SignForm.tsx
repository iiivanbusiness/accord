"use client";

import { useState, useTransition } from "react";
import SignaturePad from "./SignaturePad";

// The client-facing counterpart to every other "return { error } instead of
// throw" fix in this app — signContract used to throw for the exact things
// a client is most likely to do by accident (submit with no name, submit
// without drawing a signature yet, since neither the button nor the hidden
// signature field block that natively). A plain <form action> with no
// client-side catch turns an uncaught Server Action error into a full page
// crash via the nearest error boundary — the worst possible failure mode
// on the one page an actual client (not a teammate) uses.
export default function SignForm({
  contractId,
  signAction,
}: {
  contractId: string;
  signAction: (contractId: string, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signAction(contractId, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[13px]">{error}</div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Full name</span>
        <input name="signerName" required placeholder="Type your full name" className="input" />
      </label>
      <SignaturePad name="signatureImage" />
      <label className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        <input type="checkbox" required className="mt-0.5" />
        I have reviewed the agreement above and agree to its terms.
      </label>
      <button type="submit" disabled={isPending} className="btn btn-primary mt-1 w-full justify-center">
        {isPending ? "Signing…" : "Sign & complete"}
      </button>
    </form>
  );
}
