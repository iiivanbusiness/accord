"use client";

import { useState, useTransition } from "react";
import ClientText from "@/components/ClientText";

type ApiKeyItem = { id: string; name: string; keyPrefix: string; access: string; lastUsedAt: string | null; createdAt: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const ACCESS_LABEL: Record<string, string> = { read: "Read only", read_write: "Read and write" };

export default function ApiKeysPanel({
  keys,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyItem[];
  createAction: (formData: FormData) => Promise<string>;
  revokeAction: (keyId: string) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [access, setAccess] = useState("read");
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) {
      setError("Name the key, e.g. \"Salesforce sync\"");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", name);
        formData.set("access", access);
        const raw = await createAction(formData);
        setFreshKey(raw);
        setCopied(false);
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleRevoke(keyId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeAction(keyId);
      if (result.error) setError(result.error);
      setConfirmingRevoke(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {freshKey && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 rounded-[8px] px-3 py-2.5 font-mono-tab text-[12px]" style={{ background: "var(--surface-2)", wordBreak: "break-all" }}>
              {freshKey}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(freshKey);
                setCopied(true);
              }}
              className="btn btn-secondary btn-sm flex-none"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--warn)" }}>⚠ Copy this now. It won&apos;t be shown again.</div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No API keys yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-[8px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
              <div className="min-w-0 text-[12.5px]">
                <span className="break-words font-medium">{k.name}</span>
                <span className="ml-2 font-mono-tab" style={{ color: "var(--ink-muted)" }}>{k.keyPrefix}••••</span>
                <span className="chip chip-neutral ml-2" style={{ fontSize: 10.5 }}>{ACCESS_LABEL[k.access] ?? k.access}</span>
                <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  {k.lastUsedAt ? <>Last used <ClientText text={() => formatDate(k.lastUsedAt as string)} /></> : "Never used"} · Created <ClientText text={() => formatDate(k.createdAt)} />
                </div>
              </div>
              {confirmingRevoke === k.id ? (
                <span className="flex flex-none items-center gap-2 text-[11.5px]">
                  <span style={{ color: "var(--ink-muted)" }}>Anything using it stops working.</span>
                  <button type="button" disabled={isPending} onClick={() => handleRevoke(k.id)} className="font-medium" style={{ color: "#c0392b" }}>
                    Revoke
                  </button>
                  <button type="button" onClick={() => setConfirmingRevoke(null)} style={{ color: "var(--ink-muted)" }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" disabled={isPending} onClick={() => setConfirmingRevoke(k.id)} className="flex-none text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--hairline-soft)" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. Salesforce sync"
          className="input min-w-0 flex-1"
          style={{ fontSize: "12.5px", padding: "7px 10px", minWidth: 160 }}
          aria-label="Key name"
        />
        <select value={access} onChange={(e) => setAccess(e.target.value)} className="input flex-none" style={{ fontSize: "12.5px", padding: "7px 10px", width: "auto" }} aria-label="What the key can do">
          <option value="read">Read only</option>
          <option value="read_write">Read and write</option>
        </select>
        <button type="button" disabled={isPending} onClick={handleCreate} className="btn btn-secondary btn-sm flex-none">Generate key</button>
      </div>
    </div>
  );
}
