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

// A fixed dark-glass palette, independent of the main app's light/dark
// theme (see the layout's doc comment) — this sits on top of a native
// macOS vibrancy blur (HudWindow material, always dark), so it needs its
// own tokens rather than the app's `--ink`/`--canvas` vars, which assume an
// opaque surface underneath them.
const glass = {
  text: "rgba(255,255,255,0.94)",
  textDim: "rgba(255,255,255,0.58)",
  textFaint: "rgba(255,255,255,0.38)",
  divider: "rgba(255,255,255,0.10)",
  chipBg: "rgba(255,255,255,0.08)",
  chipBorder: "rgba(255,255,255,0.12)",
  accent: "#7fb0ff",
  accentDim: "rgba(127,176,255,0.16)",
  success: "#5fe3ac",
  successDim: "rgba(95,227,172,0.14)",
  danger: "#ff8a8a",
  dangerDim: "rgba(255,138,138,0.14)",
};

// Shared button look for this panel — small, glass "chip" style rather than
// the main app's solid .btn classes (which assume an opaque surface behind
// them and aren't meant to sit on a blurred, borderless window).
function glassButtonStyle(tone: "neutral" | "success" | "danger" = "neutral"): React.CSSProperties {
  const tint = tone === "success" ? glass.successDim : tone === "danger" ? glass.dangerDim : glass.chipBg;
  const color = tone === "success" ? glass.success : tone === "danger" ? glass.danger : glass.text;
  return {
    background: tint,
    color,
    border: `1px solid ${tone === "neutral" ? glass.chipBorder : "transparent"}`,
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1.2,
  };
}

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
// showing what's coming up next instead of an empty panel. Sits directly
// on the native vibrancy blur (see desktop-app's build_companion_window) —
// nothing here paints a solid background, by design.
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
      <div className="flex h-full items-center justify-center p-5 text-center text-[13px]" style={{ color: glass.textDim }}>
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
    <div
      className="flex h-full flex-col"
      style={{ borderRadius: 16, overflow: "hidden" }}
    >
      <div
        className="flex flex-none items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: `1px solid ${glass.divider}`, WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: session ? glass.success : glass.textFaint }}
          />
          <span className="truncate text-[12.5px] font-semibold" style={{ color: glass.text, letterSpacing: "-0.1px" }}>
            SealMe
          </span>
        </div>
        <button
          type="button"
          onClick={goToMainApp}
          aria-label="Open main app"
          title="Open main app"
          className="flex flex-none items-center justify-center rounded-[7px]"
          style={{ width: 22, height: 22, color: glass.textDim, WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
            <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
            <path d="M12 3h5v5M16.5 3.5 9 11" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        {error && (
          <div className="mb-3 rounded-[8px] px-3 py-2 text-[11.5px]" style={{ background: glass.dangerDim, color: glass.danger }}>
            {error}
          </div>
        )}

        {session ? (
          <div className="flex flex-col gap-5">
            <div
              className="flex flex-col gap-2 rounded-[12px] px-3.5 py-3"
              style={{ background: glass.successDim, border: `1px solid rgba(95,227,172,0.22)` }}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 flex-none">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: glass.success }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: glass.success }} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: glass.text }}>
                  {dealState?.clientName ?? "Recording…"}
                </span>
              </div>
              {confirmingDiscard ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[11.5px]" style={{ color: glass.textDim }}>Discard this recording?</span>
                  <button type="button" disabled={busy} onClick={handleDiscard} style={glassButtonStyle("danger")}>
                    Yes, discard
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmingDiscard(false)} style={glassButtonStyle("neutral")}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busy} onClick={handleStop} style={glassButtonStyle("success")}>
                    {busy ? "Finishing…" : "Stop & finish"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmingDiscard(true)} style={glassButtonStyle("neutral")}>
                    Discard
                  </button>
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-[10.5px] font-semibold uppercase" style={{ color: glass.textFaint, letterSpacing: "0.06em" }}>
                Deal terms
              </h2>
              {groups.size === 0 ? (
                <p className="text-[12px]" style={{ color: glass.textDim }}>Nothing captured yet — keep talking.</p>
              ) : (
                <div className="flex flex-col">
                  {[...groups.entries()].map(([label, rows]) => (
                    <div key={label} className="py-2 first:pt-0" style={{ borderTop: `1px solid ${glass.divider}` }}>
                      <div className="pb-1 text-[10px] font-semibold uppercase" style={{ color: glass.textFaint, letterSpacing: "0.05em" }}>
                        {label}
                      </div>
                      {rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-[12px]" style={{ color: glass.textDim }}>{row.label}</span>
                          <span className="truncate text-[12px] font-medium" style={{ color: glass.text }}>{row.value ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={
                {
                  "--ink-muted": glass.textDim,
                  "--hairline-soft": glass.divider,
                  "--surface-2": glass.chipBg,
                  "--accent-blue": glass.accent,
                } as React.CSSProperties
              }
            >
              <h2 className="mb-2 text-[10.5px] font-semibold uppercase" style={{ color: glass.textFaint, letterSpacing: "0.06em" }}>
                Call notes
              </h2>
              <div style={{ color: glass.text }}>
                <CallHighlightsList items={dealState?.callHighlights ?? []} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-2 text-[10.5px] font-semibold uppercase" style={{ color: glass.textFaint, letterSpacing: "0.06em" }}>
              Upcoming
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="py-6 text-center text-[12.5px]" style={{ color: glass.textDim }}>
                Nothing scheduled — start a call from the main app to see it here.
              </p>
            ) : (
              <div className="flex flex-col">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="py-2.5 first:pt-0" style={{ borderTop: `1px solid ${glass.divider}` }}>
                    <div className="text-[12.5px] font-medium" style={{ color: glass.text }}>{event.title}</div>
                    <div className="text-[11px]" style={{ color: glass.textDim }}>
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
