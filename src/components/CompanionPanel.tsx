"use client";

import { useEffect, useState } from "react";
import { LOCAL_CAPTURE_STORAGE_KEY, LOCAL_CAPTURE_EVENT } from "./LocalCaptureForm";
import CallHighlightsList, { type CallHighlightItem } from "./CallHighlightsList";

type Session = { dealId: string; token: string; startedAt: number };
type StopResult = { ok: boolean; error?: string };

type DealField = { id: string; groupLabel: string; label: string; value: string | null; status: string };
type DealState = {
  dealId: string;
  clientName: string;
  status: string;
  summary: string | null;
  fields: DealField[];
  callHighlights: CallHighlightItem[];
};

type UpcomingEvent = {
  id: string;
  title: string;
  clientName: string | null;
  startTime: string;
  platform: string;
  linkedDealId: string | null;
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(LOCAL_CAPTURE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

// The floating panel's content — a stripped-down view of the same deal
// currently being recorded (read-only terms + notes) plus quick stop/
// discard controls, so ending or checking on a call never requires
// un-collapsing the main window. When no call is active, falls back to
// showing what's coming up next instead of an empty panel.
export default function CompanionPanel({ upcomingEvents }: { upcomingEvents: UpcomingEvent[] }) {
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [dealState, setDealState] = useState<DealState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
    setSession(readSession());
    const onChange = () => setSession(readSession());
    window.addEventListener(LOCAL_CAPTURE_EVENT, onChange);
    return () => window.removeEventListener(LOCAL_CAPTURE_EVENT, onChange);
  }, []);

  // Polls while a call is active so terms/notes reflect the same ~60s-
  // throttled extraction pass the main deal page shows — not truly
  // real-time, just not stale for more than one poll cycle.
  useEffect(() => {
    if (!session) {
      setDealState(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/companion/state?dealId=${session!.dealId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as DealState;
        if (!cancelled) setDealState(data);
      } catch {
        // Best-effort — a failed poll just leaves the last-known state up.
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session]);

  async function goToMainApp() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("toggle_companion_window");
    } catch (err) {
      console.error("[companion] toggle_companion_window failed:", err);
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Couldn't open the main app");
    }
  }

  async function handleStop() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<StopResult>("stop_local_capture_and_upload", { token: session.token });
      if (!result.ok) {
        setError(result.error ?? "Something went wrong stopping the recording");
        setBusy(false);
        return;
      }
      localStorage.removeItem(LOCAL_CAPTURE_STORAGE_KEY);
      window.dispatchEvent(new Event(LOCAL_CAPTURE_EVENT));
      setSession(null);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong stopping the recording");
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setBusy(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("discard_local_capture").catch(() => {});
    } finally {
      localStorage.removeItem(LOCAL_CAPTURE_STORAGE_KEY);
      window.dispatchEvent(new Event(LOCAL_CAPTURE_EVENT));
      setSession(null);
      setBusy(false);
      setConfirmingDiscard(false);
    }
  }

  if (isTauri === null) return null;

  if (!isTauri) {
    return (
      <div className="flex h-full items-center justify-center p-5 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
        This panel only works inside the SealMe desktop app.
      </div>
    );
  }

  const groups = new Map<string, DealField[]>();
  for (const field of dealState?.fields ?? []) {
    if (!groups.has(field.groupLabel)) groups.set(field.groupLabel, []);
    groups.get(field.groupLabel)!.push(field);
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-none items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--hairline)", WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="truncate text-[13px] font-medium">SealMe</span>
        <button
          type="button"
          onClick={goToMainApp}
          className="flex-none text-[11.5px] font-medium"
          style={{ color: "var(--accent-blue)", WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          Open app ↗
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="mb-3 rounded-[8px] px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
            {error}
          </div>
        )}

        {session ? (
          <div className="flex flex-col gap-4">
            <div
              className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[12.5px]"
              style={{ background: "var(--success-soft)", color: "var(--success)" }}
            >
              <span className="inline-flex h-2 w-2 flex-none animate-pulse rounded-full" style={{ background: "var(--success)" }} />
              <span className="min-w-0 flex-1 truncate font-medium">
                Recording — {dealState?.clientName ?? "…"}
              </span>
              {confirmingDiscard ? (
                <span className="flex w-full items-center gap-2 pt-1">
                  <span className="text-[11.5px] font-medium">Discard this recording?</span>
                  <button type="button" disabled={busy} onClick={handleDiscard} className="btn btn-sm" style={{ background: "var(--warn)", color: "#fff" }}>
                    Yes
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmingDiscard(false)} className="text-[11.5px] font-medium">
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="flex w-full items-center gap-2 pt-1">
                  <button type="button" disabled={busy} onClick={handleStop} className="btn btn-sm" style={{ background: "var(--success)", color: "#fff" }}>
                    {busy ? "Finishing…" : "Stop & finish"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingDiscard(true)}
                    className="text-[11.5px] font-medium underline decoration-dotted underline-offset-2"
                  >
                    Discard
                  </button>
                </span>
              )}
            </div>

            <div>
              <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                Deal terms
              </h2>
              {groups.size === 0 ? (
                <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Nothing captured yet — keep talking.</p>
              ) : (
                <div className="flex flex-col">
                  {[...groups.entries()].map(([label, rows]) => (
                    <div key={label} className="border-b py-2 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                      <div className="pb-1 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint, var(--ink-muted))" }}>
                        {label}
                      </div>
                      {rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{row.label}</span>
                          <span className="truncate text-[12.5px] font-medium">{row.value ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                Call notes
              </h2>
              <CallHighlightsList items={dealState?.callHighlights ?? []} />
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Upcoming
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="py-6 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Nothing scheduled — start a call from the main app to see it here.
              </p>
            ) : (
              <div className="flex flex-col">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                    <div className="text-[12.5px] font-medium">{event.title}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                      {formatEventTime(event.startTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
