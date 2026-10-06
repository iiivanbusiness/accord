"use client";

import { useState, useTransition } from "react";
import { saveMyPhoneNumber } from "@/app/(app)/settings/phone-actions";

// "Your phone number": SealMe recognizes a rep by the number they call
// the SealMe number from.
export default function PhoneNumberSettings({ phone, sealmeNumber }: { phone: string | null; sealmeNumber: string | null }) {
  const [value, setValue] = useState(phone ?? "");
  const [saved, setSaved] = useState(phone);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveMyPhoneNumber(value);
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setSaved(result.phone ?? null);
      setValue(result.phone ?? "");
      setMessage({ kind: "ok", text: result.phone ? "Saved" : "Removed" });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        SealMe knows a call is yours by the number you call from. Calls to the SealMe number from any other number are turned away.
        {sealmeNumber ? <> The SealMe number is <span className="font-mono-tab">{sealmeNumber}</span>.</> : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+381 64 123 4567"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Your phone number"
          className="input"
          style={{ maxWidth: 260 }}
        />
        <button type="button" disabled={pending || value.trim() === (saved ?? "")} onClick={save} className="btn btn-secondary btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {message && (
        <div className={`chip ${message.kind === "ok" ? "chip-neutral" : "chip-warn"} w-fit max-w-full whitespace-normal break-words px-3 py-1.5 text-[12.5px]`}>{message.text}</div>
      )}
    </div>
  );
}
