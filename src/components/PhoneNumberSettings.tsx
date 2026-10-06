"use client";

import { useState, useTransition } from "react";
import { confirmMyPhoneCode, saveMyPhoneNumber, sendMyPhoneCode } from "@/app/(app)/settings/phone-actions";
import PhoneInput from "@/components/PhoneInput";

// "Your phone number": SealMe rings this number when the rep taps Call,
// then calls the client from it, so it's confirmed once with a text code.
export default function PhoneNumberSettings({
  phone,
  verified,
  canVerify,
  country,
}: {
  phone: string | null;
  verified: boolean;
  canVerify: boolean;
  country: string;
}) {
  const [value, setValue] = useState(phone ?? "");
  const [saved, setSaved] = useState(phone);
  const [isVerified, setIsVerified] = useState(verified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setMessage(null);
    startTransition(action);
  }

  const save = () =>
    run(async () => {
      const result = await saveMyPhoneNumber(value);
      if (result.error) return setMessage({ kind: "error", text: result.error });
      if (result.phone !== saved) {
        setIsVerified(false);
        setCodeSent(false);
      }
      setSaved(result.phone ?? null);
      setValue(result.phone ?? "");
      setMessage({ kind: "ok", text: result.phone ? "Saved" : "Removed" });
    });

  const sendCode = () =>
    run(async () => {
      const result = await sendMyPhoneCode();
      if (result.error) return setMessage({ kind: "error", text: result.error });
      if (result.verified) {
        setIsVerified(true);
        return setMessage({ kind: "ok", text: "Verified" });
      }
      setCodeSent(true);
      setMessage({ kind: "ok", text: "Code sent. Check your texts" });
    });

  const confirm = () =>
    run(async () => {
      const result = await confirmMyPhoneCode(code);
      if (result.error) return setMessage({ kind: "error", text: result.error });
      setIsVerified(true);
      setCodeSent(false);
      setCode("");
      setMessage({ kind: "ok", text: "Verified" });
    });

  const changed = value.trim() !== (saved ?? "");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        When you tap Call, SealMe rings this number, then calls your client from it, so they see your number. Confirm it once with a text code.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <PhoneInput value={value} onChange={setValue} fallbackCountry={country} ariaLabel="Your phone number" />
        <button type="button" disabled={pending || !changed} onClick={save} className="btn btn-secondary btn-sm mt-[3px]">
          {pending && changed ? "Saving…" : "Save"}
        </button>
      </div>

      {saved && !changed && canVerify && (
        isVerified ? (
          <div className="chip chip-success w-fit">Verified: SealMe can call from this number</div>
        ) : codeSent ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code from the text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Verification code"
              className="input"
              style={{ maxWidth: 200 }}
            />
            <button type="button" disabled={pending || !code.trim()} onClick={confirm} className="btn btn-primary btn-sm">
              {pending ? "Checking…" : "Confirm"}
            </button>
            <button type="button" disabled={pending} onClick={sendCode} className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              Send a new code
            </button>
          </div>
        ) : (
          <button type="button" disabled={pending} onClick={sendCode} className="btn btn-primary btn-sm w-fit">
            {pending ? "Sending…" : "Verify by text"}
          </button>
        )
      )}

      {message && (
        <div className={`chip ${message.kind === "ok" ? "chip-neutral" : "chip-warn"} w-fit max-w-full whitespace-normal break-words px-3 py-1.5 text-[12.5px]`}>{message.text}</div>
      )}
    </div>
  );
}
