"use client";

import { useEffect, useState, useTransition } from "react";
import LocalDateTime from "@/components/LocalDateTime";
import type { CrmLeadOptions } from "@/app/(app)/settings/crm-lead-actions";
import type { CrmSource, SyncSummary } from "@/lib/crm-leads";

type Filter = Record<string, string[] | boolean>;

// "Lead import" inside a connected CRM's card in Settings: turn it on,
// pick which records come in, sync, and (HubSpot) set up instant updates.
export default function CrmLeadImportPanel({
  crm,
  enabled,
  filter: initialFilter,
  syncedAt,
  webhook,
  setEnabledAction,
  saveFilterAction,
  loadOptionsAction,
  syncAction,
  saveSecretAction,
}: {
  crm: CrmSource;
  enabled: boolean;
  filter: Filter;
  syncedAt: string | null;
  webhook?: { url: string; secretSaved: boolean };
  setEnabledAction: (crm: CrmSource, enabled: boolean) => Promise<{ error?: string }>;
  saveFilterAction: (crm: CrmSource, filter: Filter) => Promise<{ error?: string }>;
  loadOptionsAction: (crm: CrmSource) => Promise<CrmLeadOptions | { error: string }>;
  syncAction: (crm: CrmSource) => Promise<SyncSummary | { error: string }>;
  saveSecretAction?: (secret: string) => Promise<{ error?: string }>;
}) {
  const name = crm === "hubspot" ? "HubSpot" : "Salesforce";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [dirty, setDirty] = useState(false);
  const [options, setOptions] = useState<CrmLeadOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [secret, setSecret] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || options) return;
    let cancelled = false;
    loadOptionsAction(crm).then((res) => {
      if (cancelled) return;
      if ("error" in res) setOptionsError(res.error);
      else setOptions(res);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, options, crm, loadOptionsAction]);

  function run(fn: () => Promise<void>) {
    setMessage(null);
    startTransition(fn);
  }

  const toggleValue = (key: string, value: string) => {
    const current = (filter[key] as string[] | undefined) ?? [];
    setFilter({ ...filter, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
    setDirty(true);
  };

  const summaryText = (s: SyncSummary) => {
    const parts = [`${s.created.toLocaleString("en-US")} new`, `${s.updated.toLocaleString("en-US")} updated`];
    if (s.skipped) parts.push(`${s.skipped.toLocaleString("en-US")} skipped`);
    return `Synced: ${parts.join(", ")}.${s.more ? " There's more to bring in, sync again to continue." : ""}`;
  };

  return (
    <div className="flex flex-col gap-3.5 border-t px-[22px] py-[18px]" style={{ borderColor: "var(--hairline)" }}>
      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-[13px] font-medium">Bring leads into SealMe</span>
          <span className="mt-0.5 block text-[12px]" style={{ color: "var(--ink-muted)" }}>
            New and changed {crm === "hubspot" ? "contacts" : "Leads"} in {name} show up in Leads. Whoever owns them in {name} gets them here too, with a call task for today.
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 flex-none"
          checked={enabled}
          disabled={pending}
          onChange={(e) => run(async () => {
            const res = await setEnabledAction(crm, e.target.checked);
            if (res.error) setMessage({ tone: "warn", text: res.error });
          })}
          aria-label={`Bring leads in from ${name}`}
        />
      </label>

      {enabled && (
        <>
          <div className="flex flex-col gap-2.5">
            <div className="text-[12.5px] font-medium">Which ones</div>
            {optionsError && <div className="text-[12px]" style={{ color: "#c0392b" }}>{optionsError}</div>}
            {!options && !optionsError && <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Loading options from {name}…</div>}
            {options?.groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5">
                <div className="text-[11.5px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  {g.label} <span className="normal-case tracking-normal">· none ticked means all</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.length === 0 && <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>No values set up in {name}.</span>}
                  {g.options.map((o) => {
                    const on = ((filter[g.key] as string[] | undefined) ?? []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        disabled={pending}
                        aria-pressed={on}
                        onClick={() => toggleValue(g.key, o.value)}
                        className="btn btn-sm"
                        style={on ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={filter.teamOwnedOnly === true}
                disabled={pending}
                onChange={(e) => {
                  setFilter({ ...filter, teamOwnedOnly: e.target.checked });
                  setDirty(true);
                }}
              />
              Only leads owned by someone on this team (matched by email)
            </label>
            {dirty && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(async () => {
                  const res = await saveFilterAction(crm, filter);
                  if (res.error) setMessage({ tone: "warn", text: res.error });
                  else {
                    setDirty(false);
                    setMessage({ tone: "ok", text: "Saved. The next sync uses this." });
                  }
                })}
                className="btn btn-secondary btn-sm self-start"
              >
                Save
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {syncedAt ? (
                <>
                  Last synced <LocalDateTime iso={syncedAt} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                </>
              ) : (
                "Not synced yet. The first sync brings in everything that matches."
              )}
            </div>
            <button
              type="button"
              disabled={pending || dirty}
              title={dirty ? "Save the filter first" : undefined}
              onClick={() => run(async () => {
                const res = await syncAction(crm);
                setMessage("error" in res ? { tone: "warn", text: res.error } : { tone: "ok", text: summaryText(res) });
              })}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Working…" : "Sync now"}
            </button>
          </div>

          {crm === "salesforce" && (
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              SealMe also checks for changes whenever someone opens Leads, and once a day.
            </div>
          )}

          {crm === "hubspot" && webhook && saveSecretAction && (
            <div className="flex flex-col gap-2 rounded-[12px] border p-3.5" style={{ borderColor: "var(--hairline)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-medium">Instant updates</span>
                <span className={`chip ${webhook.secretSaved ? "chip-success" : "chip-neutral"}`}>{webhook.secretSaved ? "On" : "Off"}</span>
              </div>
              <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                In HubSpot: <strong>Development → Legacy Apps → your private app → Webhooks</strong>. Set the target URL below and subscribe to Contact <em>Created</em> and <em>Property changed</em>. Then paste the app&apos;s <strong>Client secret</strong> (Auth tab) here.
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={webhook.url} className="input flex-1 font-mono-tab" style={{ fontSize: "12px", padding: "7px 10px" }} onFocus={(e) => e.currentTarget.select()} aria-label="Webhook URL" />
                <button type="button" onClick={() => navigator.clipboard?.writeText(webhook.url)} className="btn btn-secondary btn-sm flex-none">
                  Copy
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const res = await saveSecretAction(secret);
                    if (res.error) setMessage({ tone: "warn", text: res.error });
                    else {
                      setSecret("");
                      setMessage({ tone: "ok", text: secret ? "Client secret saved. Instant updates are on." : "Instant updates are off." });
                    }
                  });
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={webhook.secretSaved ? "Saved. Paste a new one to replace it" : "Client secret"}
                  className="input flex-1 font-mono-tab"
                  style={{ fontSize: "12.5px", padding: "7px 10px" }}
                  aria-label="HubSpot client secret"
                  autoComplete="off"
                />
                <button type="submit" disabled={pending || !secret} className="btn btn-secondary btn-sm flex-none">
                  Save
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {message && (
        <div className={`chip ${message.tone === "ok" ? "chip-success" : "chip-warn"} w-full justify-start whitespace-normal px-3 py-2 text-[12.5px]`} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
}
