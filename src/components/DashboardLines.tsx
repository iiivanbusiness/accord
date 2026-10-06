"use client";

import { useState, useTransition } from "react";
import { DEFAULT_LINES, LINE_TITLES, TONE_LABEL, type LineId, type LineRole, type LineTone, type SavedLines } from "@/lib/dashboard-lines";

export type DashboardLine = { id: LineId; summary: string; meta?: string; tone: LineTone; body: React.ReactNode };
type Prefs = { order: LineId[]; hidden: LineId[]; open: LineId[] };

const TONE_COLOR: Record<LineTone, string> = {
  urgent: "var(--tone-urgent)",
  due: "var(--tone-due)",
  new: "var(--tone-new)",
  good: "var(--tone-good)",
  quiet: "var(--tone-quiet)",
};

function Dot({ tone, size = 10 }: { tone: LineTone; size?: number }) {
  return <span aria-hidden className="flex-none rounded-full" style={{ width: size, height: size, background: TONE_COLOR[tone] }} />;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="flex-none transition-transform" style={{ color: "var(--ink-muted)", transform: open ? "rotate(90deg)" : undefined }}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

// The lines above the Dashboard widgets: each a colored dot (how urgent),
// a title and one line of what's going on. A tap opens the line;
// "Customize lines" picks which show, their order and which start open.
export default function DashboardLines({
  role,
  lines,
  prefs: savedPrefs,
  initialOpen,
  notice,
  customizeExtra,
  saveAction,
}: {
  role: LineRole;
  lines: DashboardLine[];
  prefs: Prefs;
  initialOpen: LineId[];
  notice?: React.ReactNode;
  customizeExtra?: React.ReactNode;
  saveAction: (lines: SavedLines | null) => Promise<void>;
}) {
  const [prefs, setPrefs] = useState(savedPrefs);
  const [open, setOpen] = useState(() => new Set(initialOpen));
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(lines.map((l) => [l.id, l]));
  const visible = prefs.order.filter((id) => !prefs.hidden.includes(id));

  const toggle = (id: LineId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function save(next: Prefs, reset = false) {
    setError(null);
    startTransition(async () => {
      try {
        await saveAction(reset ? null : { v: 1, ...next });
        setPrefs(next);
        setDraft(null);
      } catch {
        setError("Couldn't save your layout. Try again.");
      }
    });
  }

  const header = (
    <div className="flex min-h-[34px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
        {draft ? "Turn lines on or off and move them up or down. Only you see your layout." : "Today at a glance. Tap a line to open it."}
      </span>
      {!draft && (
        <button type="button" onClick={() => setDraft({ ...prefs })} className="btn btn-secondary btn-sm">
          Customize lines
        </button>
      )}
    </div>
  );

  if (draft) {
    const move = (i: number, by: -1 | 1) => {
      const order = [...draft.order];
      [order[i], order[i + by]] = [order[i + by], order[i]];
      setDraft({ ...draft, order });
    };
    const flip = (key: "hidden" | "open", id: LineId) =>
      setDraft({ ...draft, [key]: draft[key].includes(id) ? draft[key].filter((x) => x !== id) : [...draft[key], id] });

    return (
      <div className="flex w-full flex-col gap-3">
        {header}
        <div className="card overflow-hidden">
          {draft.order.map((id, i) => {
            const shown = !draft.hidden.includes(id);
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4" style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
                <div className="flex flex-none flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${LINE_TITLES[id]} up`} className="flex h-6 w-7 items-center justify-center rounded-[6px] disabled:opacity-25" style={{ color: "var(--ink-muted)" }}>
                    <svg aria-hidden viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 10 8 5.5 12.5 10" /></svg>
                  </button>
                  <button type="button" disabled={i === draft.order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${LINE_TITLES[id]} down`} className="flex h-6 w-7 items-center justify-center rounded-[6px] disabled:opacity-25" style={{ color: "var(--ink-muted)" }}>
                    <svg aria-hidden viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 6 8 10.5 12.5 6" /></svg>
                  </button>
                </div>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={shown ? undefined : { color: "var(--ink-muted)" }}>{LINE_TITLES[id]}</span>
                {shown && (
                  <label className="flex flex-none cursor-pointer items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                    <input type="checkbox" checked={draft.open.includes(id)} onChange={() => flip("open", id)} />
                    Open at start
                  </label>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  aria-label={`Show ${LINE_TITLES[id]}`}
                  onClick={() => flip("hidden", id)}
                  className="relative h-6 w-10 flex-none rounded-full transition-colors"
                  style={{ background: shown ? "var(--ink)" : "var(--tone-quiet)" }}
                >
                  <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full transition-all" style={{ left: shown ? 19 : 3, background: "var(--surface-1)" }} />
                </button>
              </div>
            );
          })}
        </div>
        {customizeExtra && <div className="px-1">{customizeExtra}</div>}
        {error && <div className="chip chip-warn w-fit">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" disabled={pending} onClick={() => save(DEFAULT_LINES[role], true)} className="text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
            Reset to default
          </button>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => setDraft(null)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => save(draft)} className="btn btn-primary btn-sm">
              {pending ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tones = [...new Set(visible.map((id) => byId.get(id)?.tone).filter((t): t is LineTone => Boolean(t && t !== "quiet")))];

  return (
    <div className="flex w-full flex-col gap-3">
      {header}
      {notice}
      <div className="flex flex-col gap-2">
        {visible.map((id) => {
          const line = byId.get(id);
          const isOpen = open.has(id) && Boolean(line);
          const tone = line?.tone ?? "quiet";
          return (
            <section key={id} className="card overflow-hidden">
              <button type="button" aria-expanded={isOpen} onClick={() => toggle(id)} className="row-hover flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
                <Dot tone={tone} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-[14px] font-medium sm:w-[150px] sm:flex-none" style={{ color: "var(--ink)" }}>{LINE_TITLES[id]}</span>
                  <span
                    className="truncate text-[13px] sm:text-[14px]"
                    style={{ color: tone === "urgent" ? "var(--tone-urgent)" : tone === "due" || tone === "new" ? "var(--ink)" : "var(--ink-muted)", fontWeight: tone === "urgent" ? 500 : undefined }}
                  >
                    {line?.summary ?? "Loading…"}
                  </span>
                </span>
                {line?.meta && <span className="hidden flex-none text-[12.5px] tabular-nums sm:inline" style={{ color: "var(--ink-muted)" }}>{line.meta}</span>}
                <Chevron open={isOpen} />
              </button>
              {isOpen && <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>{line?.body}</div>}
            </section>
          );
        })}
        {visible.length === 0 && (
          <div className="card px-5 py-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Every line is turned off. Tap Customize to bring some back.
          </div>
        )}
      </div>
      {tones.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          {(["urgent", "due", "new", "good"] as const).filter((t) => tones.includes(t)).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Dot tone={t} size={8} />
              {TONE_LABEL[t]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
