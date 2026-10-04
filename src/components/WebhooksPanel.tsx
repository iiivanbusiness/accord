"use client";

import { useState, useTransition } from "react";
import ClientText from "@/components/ClientText";

type Delivery = { id: string; event: string; status: string; attempts: number; nextAttemptAt: string | null; responseStatus: number | null; error: string | null; createdAt: string };
type Endpoint = { id: string; url: string; secret: string; events: string[]; enabled: boolean; deliveries: Delivery[] };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DeliveryStatus({ d, maxAttempts }: { d: Delivery; maxAttempts: number }) {
  if (d.status === "delivered") return <span style={{ color: "var(--accent-blue)" }}>Delivered{d.responseStatus ? ` · ${d.responseStatus}` : ""}</span>;
  const why = d.error ?? (d.responseStatus ? `Answered ${d.responseStatus}` : null);
  if (d.status === "pending") {
    return (
      <span className="chip chip-warn" style={{ fontSize: 10.5 }} title={why ?? undefined}>
        {d.attempts === 0 ? "Sending" : <>Retrying · {d.attempts} of {maxAttempts}{d.nextAttemptAt && <> · next <ClientText text={() => formatDate(d.nextAttemptAt as string)} /></>}</>}
      </span>
    );
  }
  return <span style={{ color: "#c0392b" }} title={why ?? undefined}>Failed{why ? ` · ${why}` : ""}</span>;
}

function EndpointCard({
  endpoint,
  maxAttempts,
  toggleAction,
  deleteAction,
  testAction,
  resendAction,
}: {
  endpoint: Endpoint;
  maxAttempts: number;
  toggleAction: (id: string) => Promise<{ error?: string }>;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  testAction: (id: string) => Promise<{ error?: string }>;
  resendAction: (deliveryId: string) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-[10px] border px-3.5 py-3" style={{ borderColor: "var(--hairline-soft)" }}>
      {error && (
        <div className="mb-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{endpoint.url}</div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {endpoint.events.map((e) => <span key={e} className="chip chip-neutral" style={{ fontSize: 10.5 }}>{e}</span>)}
            {!endpoint.enabled && <span className="chip chip-warn" style={{ fontSize: 10.5 }}>Paused</span>}
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <button type="button" disabled={isPending} onClick={() => run(() => testAction(endpoint.id))} className="text-[11.5px] font-medium" style={{ color: "var(--accent-blue)" }}>Send test</button>
          <button type="button" disabled={isPending} onClick={() => run(() => toggleAction(endpoint.id))} className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
            {endpoint.enabled ? "Pause" : "Resume"}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <button type="button" disabled={isPending} onClick={() => run(() => deleteAction(endpoint.id))} className="text-[11.5px] font-medium" style={{ color: "#c0392b" }}>Confirm</button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>Delete</button>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>Signing secret:</span>
        <span className="font-mono-tab text-[11px]" style={{ color: "var(--ink-muted)" }}>
          {showSecret ? endpoint.secret : `${endpoint.secret.slice(0, 10)}${"•".repeat(18)}`}
        </span>
        <button type="button" onClick={() => setShowSecret((s) => !s)} className="text-[11px] font-medium" style={{ color: "var(--accent-blue)" }}>
          {showSecret ? "Hide" : "Reveal"}
        </button>
      </div>

      {endpoint.deliveries.length > 0 && (
        <div className="mt-2.5 border-t pt-2" style={{ borderColor: "var(--hairline-soft)" }}>
          <div className="mb-1 text-[10.5px] font-medium" style={{ color: "var(--ink-muted)" }}>RECENT DELIVERIES</div>
          <div className="flex flex-col gap-1">
            {endpoint.deliveries.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                <span className="min-w-0">{d.event} · <ClientText text={() => formatDate(d.createdAt)} /></span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-words text-right"><DeliveryStatus d={d} maxAttempts={maxAttempts} /></span>
                  {d.status === "failed" && d.event !== "test" && (
                    <button type="button" disabled={isPending} onClick={() => run(() => resendAction(d.id))} className="flex-none font-medium" style={{ color: "var(--accent-blue)" }}>
                      Resend
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WebhooksPanel({
  endpoints,
  availableEvents,
  maxAttempts,
  createAction,
  toggleAction,
  deleteAction,
  testAction,
  resendAction,
}: {
  endpoints: Endpoint[];
  availableEvents: string[];
  maxAttempts: number;
  createAction: (formData: FormData) => Promise<{ error?: string }>;
  toggleAction: (id: string) => Promise<{ error?: string }>;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  testAction: (id: string) => Promise<{ error?: string }>;
  resendAction: (deliveryId: string) => Promise<{ error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Not a form action: React would clear the form even when the address
  // is turned down, losing what was typed. Cleared only once it's added.
  function runCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await createAction(formData);
      if (result.error) setError(result.error);
      else form.reset();
    });
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      {endpoints.length === 0 && (
        <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No webhook endpoints yet.</div>
      )}

      <div className="flex flex-col gap-2.5">
        {endpoints.map((e) => (
          <EndpointCard key={e.id} endpoint={e} maxAttempts={maxAttempts} toggleAction={toggleAction} deleteAction={deleteAction} testAction={testAction} resendAction={resendAction} />
        ))}
      </div>

      <div className="border-t pt-3" style={{ borderColor: "var(--hairline-soft)" }}>
        {error && (
          <div className="mb-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
            {error}
          </div>
        )}
        <form onSubmit={runCreate} className="flex flex-col gap-2">
          <input name="url" type="url" required placeholder="https://your-system.com/webhooks/sealme" className="input" style={{ fontSize: "12.5px", padding: "7px 10px" }} />
          <div className="flex flex-wrap gap-3">
            {availableEvents.map((event) => (
              <label key={event} className="flex items-center gap-1.5 text-[12px]">
                <input type="checkbox" name="events" value={event} />
                {event}
              </label>
            ))}
          </div>
          <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm self-start">+ Add endpoint</button>
        </form>
      </div>
    </div>
  );
}
