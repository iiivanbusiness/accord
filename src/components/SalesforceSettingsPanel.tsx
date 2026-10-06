"use client";

import { useState, useTransition } from "react";
import ExternalConnectLink from "./ExternalConnectLink";

export default function SalesforceSettingsPanel({
  configured,
  available,
  connected,
  accountEmail,
  enabled,
  toggleAction,
  disconnectAction,
}: {
  configured: boolean;
  // Salesforce still has to approve SealMe for any company's org (see
  // canConnectSalesforce); until then most workspaces can't connect.
  available: boolean;
  connected: boolean;
  accountEmail: string | null;
  enabled: boolean;
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

  if (!configured) {
    return (
      <div className="px-[22px] py-[18px] text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        Salesforce isn&apos;t set up for this deployment yet. A SALESFORCE_CLIENT_ID/SECRET needs to be configured first.
      </div>
    );
  }

  if (!connected && !available) {
    return (
      <div className="flex flex-col gap-1 px-[22px] py-[18px]">
        <span className="chip chip-neutral w-fit">Coming soon</span>
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          Salesforce is still approving SealMe&apos;s app for other companies&apos; orgs. We&apos;ll turn this on as soon as they do. HubSpot works today.
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="px-[22px] py-[18px]">
        <ExternalConnectLink href="/api/salesforce/connect" className="btn btn-secondary btn-sm inline-flex">Connect Salesforce</ExternalConnectLink>
        <div className="mt-2 text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
          Requires admin access to your own Salesforce org.
        </div>
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
          Connected as <span className="font-medium">{accountEmail}</span>
        </div>
        <button type="button" disabled={isPending} onClick={() => run(toggleAction)} className={`btn btn-sm flex-none ${enabled ? "btn-secondary" : "btn-primary"}`}>
          {enabled ? "Pause" : "Resume"}
        </button>
      </div>

      <button type="button" disabled={isPending} onClick={() => run(disconnectAction)} className="self-start text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
        Disconnect Salesforce
      </button>
    </div>
  );
}
