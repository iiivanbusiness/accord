"use client";

import { useState, useTransition } from "react";

export default function SsoSettingsPanel({
  ssoEnabled,
  currentIssuer,
  currentClientId,
  hasClientSecret,
  redirectUri,
  updateConfigAction,
  toggleAction,
}: {
  ssoEnabled: boolean;
  currentIssuer: string | null;
  currentClientId: string | null;
  hasClientSecret: boolean;
  redirectUri: string;
  updateConfigAction: (formData: FormData) => Promise<void>;
  toggleAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      try {
        await toggleAction();
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13.5px] font-medium">Single sign-on (OIDC)</div>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Let teammates sign in through your identity provider (Okta, Azure AD/Entra, Google Workspace) instead of a password.
          </div>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggle}
          className={`btn btn-sm flex-none ${ssoEnabled ? "btn-secondary" : "btn-primary"}`}
        >
          {ssoEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Redirect URI — give this to your identity provider
        </div>
        <div className="rounded-[8px] px-3 py-2.5 font-mono-tab text-[12px]" style={{ background: "var(--surface-2)", wordBreak: "break-all" }}>
          {redirectUri}
        </div>
      </div>

      <form action={updateConfigAction} className="flex flex-col gap-3 border-t pt-[18px]" style={{ borderColor: "var(--hairline-soft)" }}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Issuer URL</span>
          <input
            name="issuer"
            defaultValue={currentIssuer ?? ""}
            placeholder="https://mycompany.okta.com"
            className="input"
            style={{ fontSize: "13px", padding: "8px 11px" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Client ID</span>
          <input
            name="clientId"
            defaultValue={currentClientId ?? ""}
            placeholder="0oa1b2c3d4e5f6g7h8i9"
            className="input"
            style={{ fontSize: "13px", padding: "8px 11px" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">
            Client secret {hasClientSecret && <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>(set — leave blank to keep it)</span>}
          </span>
          <input
            name="clientSecret"
            type="password"
            placeholder={hasClientSecret ? "••••••••••••••••" : "paste client secret"}
            className="input"
            style={{ fontSize: "13px", padding: "8px 11px" }}
          />
        </label>
        <button type="submit" className="btn btn-secondary btn-sm self-start">Save</button>
      </form>
    </div>
  );
}
