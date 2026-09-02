"use client";

import { useState, useTransition } from "react";

export default function ScimSettingsPanel({
  currentDomain,
  hasScimToken,
  scimBaseUrl,
  updateDomainAction,
  generateTokenAction,
  revokeTokenAction,
}: {
  currentDomain: string | null;
  hasScimToken: boolean;
  scimBaseUrl: string;
  updateDomainAction: (formData: FormData) => Promise<void>;
  generateTokenAction: () => Promise<string>;
  revokeTokenAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const token = await generateTokenAction();
        setFreshToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      try {
        await revokeTokenAction();
        setFreshToken(null);
        setConfirmingRevoke(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-[18px] px-[22px] py-[18px]">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      <div>
        <div className="text-[13.5px] font-medium">Restrict sign-ups to a domain</div>
        <div className="mb-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          Only @this-domain email addresses can be invited or provisioned once set.
        </div>
        <form action={updateDomainAction} className="flex gap-2">
          <input name="domain" defaultValue={currentDomain ?? ""} placeholder="acme.com" className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} />
          <button type="submit" className="btn btn-secondary btn-sm">Save</button>
        </form>
      </div>

      <div className="border-t pt-[18px]" style={{ borderColor: "var(--hairline-soft)" }}>
        <div className="text-[13.5px] font-medium">SCIM provisioning</div>
        <div className="mb-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          Point your identity provider&apos;s SCIM connector (Okta, Azure AD/Entra) here to auto-create and auto-deactivate teammates.
        </div>

        <div className="mb-2.5 rounded-[8px] px-3 py-2.5 text-[12px]" style={{ background: "var(--surface-2)", wordBreak: "break-all" }}>
          {scimBaseUrl}
        </div>

        {freshToken ? (
          <div className="mb-2.5 flex flex-col gap-1.5">
            <div className="rounded-[8px] px-3 py-2.5 font-mono-tab text-[12px]" style={{ background: "var(--surface-2)", wordBreak: "break-all" }}>
              {freshToken}
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--warn)" }}>
              ⚠ Copy this now — it won&apos;t be shown again.
            </div>
          </div>
        ) : (
          <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            {hasScimToken ? "A token is set (hidden after generation)." : "No token generated yet."}
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={handleGenerate} className="btn btn-secondary btn-sm">
            {hasScimToken ? "Regenerate token" : "Generate token"}
          </button>
          {hasScimToken && (
            confirmingRevoke ? (
              <span className="flex items-center gap-2">
                <button type="button" disabled={isPending} onClick={handleRevoke} className="text-[12px] font-medium" style={{ color: "#c0392b" }}>
                  Confirm revoke
                </button>
                <button type="button" onClick={() => setConfirmingRevoke(false)} className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmingRevoke(true)} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                Revoke
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
