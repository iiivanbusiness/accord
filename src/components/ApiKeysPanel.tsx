"use client";

import { useState, useTransition } from "react";

type ApiKeyItem = { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ApiKeysPanel({
  keys,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyItem[];
  createAction: (formData: FormData) => Promise<string>;
  revokeAction: (keyId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [name, setName] = useState("");
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
        const raw = await createAction(formData);
        setFreshKey(raw);
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleRevoke(keyId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await revokeAction(keyId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
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
          <div className="rounded-[8px] px-3 py-2.5 font-mono-tab text-[12px]" style={{ background: "var(--surface-2)", wordBreak: "break-all" }}>
            {freshKey}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--warn)" }}>⚠ Copy this now — it won&apos;t be shown again.</div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No API keys yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
              <div className="text-[12.5px]">
                <span className="font-medium">{k.name}</span>
                <span className="ml-2 font-mono-tab" style={{ color: "var(--ink-muted)" }}>{k.keyPrefix}••••</span>
                <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  {k.lastUsedAt ? `Last used ${formatDate(k.lastUsedAt)}` : "Never used"} · Created {formatDate(k.createdAt)}
                </div>
              </div>
              <button type="button" disabled={isPending} onClick={() => handleRevoke(k.id)} className="text-[11.5px] font-medium flex-none" style={{ color: "var(--ink-muted)" }}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--hairline-soft)" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. Salesforce sync"
          className="input flex-1"
          style={{ fontSize: "12.5px", padding: "7px 10px" }}
        />
        <button type="button" disabled={isPending} onClick={handleCreate} className="btn btn-secondary btn-sm flex-none">Generate key</button>
      </div>
    </div>
  );
}
