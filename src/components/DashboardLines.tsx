"use client";

import { useRef, useState, useTransition } from "react";
import FolderIcon from "@/components/dashboard/FolderIcon";
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

const ARROW = { up: "M3.5 10 8 5.5 12.5 10", down: "M3.5 6 8 10.5 12.5 6" };

// "Today" above the Dashboard widgets, in the same folder grid as Deals by
// status: one folder per thing (team today, next up, deals...), a colored
// badge for how urgent it is and one line of what's going on. A tap opens
// the folder's contents under the grid; Customize picks which folders
// show, their order and which one starts open.
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
  // Something late beats the folder picked to start open.
  const [selected, setSelected] = useState<LineId | null>(() => initialOpen.find((id) => lines.some((l) => l.id === id && l.tone === "urgent")) ?? initialOpen[0] ?? null);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const visible = prefs.order.filter((id) => !prefs.hidden.includes(id));
  const current = selected && visible.includes(selected) ? byId.get(selected) : undefined;

  function pick(id: LineId) {
    const next = selected === id ? null : id;
    setSelected(next);
    // On a phone the contents open below the whole grid, so bring them up.
    if (next) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

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

  const heading = (
    <div className="mb-3 flex min-h-[30px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="text-[13px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        {draft ? "Customize today" : "Today"}
      </h2>
      {!draft && (
        <button type="button" onClick={() => setDraft({ ...prefs })} className="btn btn-secondary btn-sm">
          Customize
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
    const toggleShown = (id: LineId) => setDraft({ ...draft, hidden: draft.hidden.includes(id) ? draft.hidden.filter((x) => x !== id) : [...draft.hidden, id] });
    // One folder opens at a time, so only one can start open.
    const toggleOpen = (id: LineId) => setDraft({ ...draft, open: draft.open.includes(id) ? [] : [id] });

    return (
      <div className="flex w-full flex-col gap-3">
        <div className="glass-card glass-card-solid p-5">
          {heading}
          <div className="mb-3 text-[13px]" style={{ color: "var(--ink-muted)" }}>
            Turn folders on or off and move them up or down. Only you see your layout.
          </div>
          <div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
            {draft.order.map((id, i) => {
              const shown = !draft.hidden.includes(id);
              return (
                <div key={id} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4" style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
                  <div className="flex flex-none flex-col">
                    {(["up", "down"] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        disabled={dir === "up" ? i === 0 : i === draft.order.length - 1}
                        onClick={() => move(i, dir === "up" ? -1 : 1)}
                        aria-label={`Move ${LINE_TITLES[id]} ${dir}`}
                        className="flex h-6 w-7 items-center justify-center rounded-[6px] disabled:opacity-25"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        <svg aria-hidden viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <path d={ARROW[dir]} />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={shown ? undefined : { color: "var(--ink-muted)" }}>{LINE_TITLES[id]}</span>
                  {shown && (
                    <label className="flex flex-none cursor-pointer items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                      <input type="checkbox" checked={draft.open.includes(id)} onChange={() => toggleOpen(id)} />
                      Open at start
                    </label>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={shown}
                    aria-label={`Show ${LINE_TITLES[id]}`}
                    onClick={() => toggleShown(id)}
                    className="relative h-6 w-10 flex-none rounded-full transition-colors"
                    style={{ background: shown ? "var(--ink)" : "var(--tone-quiet)" }}
                  >
                    <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full transition-all" style={{ left: shown ? 19 : 3, background: "var(--surface-1)" }} />
                  </button>
                </div>
              );
            })}
          </div>
          {customizeExtra && <div className="mt-3 px-1">{customizeExtra}</div>}
          {error && <div className="chip chip-warn mt-3 w-fit">{error}</div>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
      </div>
    );
  }

  const tones = [...new Set(visible.map((id) => byId.get(id)?.tone).filter((t): t is LineTone => Boolean(t && t !== "quiet")))];

  return (
    <div className="flex w-full flex-col gap-3">
      {notice}
      <div className="glass-card glass-card-solid @container p-5">
        {heading}
        {visible.length === 0 ? (
          <div className="py-4 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Every folder is turned off. Tap Customize to bring some back.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 @sm:grid-cols-4 @3xl:grid-cols-8">
            {visible.map((id) => {
              const line = byId.get(id);
              const tone = line?.tone ?? "quiet";
              const active = current?.id === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-expanded={active}
                  onClick={() => pick(id)}
                  className="group card-hover flex min-w-0 flex-col items-center gap-2.5 rounded-[14px] px-2 py-4 text-center hover:bg-[var(--surface-1)]"
                  style={{ opacity: tone === "quiet" && !active ? 0.55 : 1, background: active ? "var(--surface-1)" : undefined, boxShadow: active ? "inset 0 0 0 1.5px var(--ink)" : undefined }}
                >
                  <span className="relative inline-flex transition-transform duration-150 group-hover:scale-[1.08]">
                    <FolderIcon id={`today-${id}`} size={64} />
                    {tone !== "quiet" && (
                      <span aria-hidden className="absolute -right-1 top-0.5 h-3.5 w-3.5 rounded-full" style={{ background: TONE_COLOR[tone], boxShadow: "0 0 0 2.5px var(--surface-1)" }} />
                    )}
                  </span>
                  <div className="w-full min-w-0">
                    <div className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>{LINE_TITLES[id]}</div>
                    <div
                      className="line-clamp-2 break-words text-[11px] leading-snug"
                      style={{ color: tone === "urgent" ? "var(--tone-urgent)" : "var(--ink-muted)", fontWeight: tone === "urgent" ? 500 : undefined }}
                    >
                      {line?.summary ?? "Loading…"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {current && (
          <div ref={panelRef} className="mt-4 overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--hairline-soft)" }}>
              <Dot tone={current.tone} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{LINE_TITLES[current.id]}</div>
                <div className="truncate text-[12.5px]" style={{ color: current.tone === "urgent" ? "var(--tone-urgent)" : "var(--ink-muted)" }}>
                  {current.summary}
                  {current.meta ? ` · ${current.meta}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="row-hover flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ color: "var(--ink-muted)" }}>
                <svg aria-hidden viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            {current.body}
          </div>
        )}

        {tones.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            {(["urgent", "due", "new", "good"] as const).filter((t) => tones.includes(t)).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Dot tone={t} size={8} />
                {TONE_LABEL[t]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
