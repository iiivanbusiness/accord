"use client";

import { useState, useTransition } from "react";
import SignaturePad from "./SignaturePad";

// Same reasoning as SignForm — a counter-signer submitting before drawing
// a signature used to crash the whole page instead of showing a message.
export default function CountersignForm({
  contractId,
  token,
  signAction,
}: {
  contractId: string;
  token: string;
  signAction: (contractId: string, token: string, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signAction(contractId, token, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="chip chip-warn w-full justify-start px-4 py-2.5 text-[13px]">{error}</div>
      )}
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
