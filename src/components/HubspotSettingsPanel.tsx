"use client";

import { useState, useTransition } from "react";

export default function HubspotSettingsPanel({
  connected,
  portalId,
  enabled,
  connectAction,
  toggleAction,
  disconnectAction,
}: {
  connected: boolean;
  portalId: string | null;
  enabled: boolean;
  connectAction: (formData: FormData) => Promise<void>;
  toggleAction: () => Promise<void>;
  disconnectAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (!connected) {
    return (
      <div className="flex flex-col gap-2.5 px-[22px] py-[18px]">
        {error && (
          <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
            {error}
          </div>
        )}
        <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
          In your HubSpot account: <strong>Settings → Integrations → Private Apps → Create a private app</strong>, grant the
          contacts/deals read+write scopes, then paste the token it gives you.
        </div>
        <form action={(formData) => run(() => connectAction(formData))} className="flex items-center gap-2">
          <input
            name="token"
            type="password"
            required
            placeholder="pat-..."
            className="input flex-1 font-mono-tab"
            style={{ fontSize: "12.5px", padding: "7px 10px" }}
          />
          <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm flex-none">Connect</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="text-[12.5px]">
          Connected to portal <span className="font-medium">{portalId}</span>
        </div>
        <button type="button" disabled={isPending} onClick={() => run(toggleAction)} className={`btn btn-sm flex-none ${enabled ? "btn-secondary" : "btn-primary"}`}>
          {enabled ? "Pause" : "Resume"}
        </button>
      </div>

      <button type="button" disabled={isPending} onClick={() => run(disconnectAction)} className="self-start text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
        Disconnect HubSpot
      </button>
    </div>
  );
}
