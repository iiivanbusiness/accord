"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LeadCallButton from "@/components/LeadCallButton";
import QuickAssign from "@/components/QuickAssign";
import TaskDigestToggle from "@/components/TaskDigestToggle";
import TaskFields, { todayLocal, viewerTimeZone, type TaskDraft } from "@/components/TaskFields";
import type { CallPlan } from "@/app/(app)/leads/phone-actions";

export type TodoRow = {
  key: string;
  kind: "task" | "call" | "event" | "summary";
  time: string | null;
  late: boolean;
  title: string;
  href: string | null;
  detail: string;
  who: string | null; // whose it is, in the team view
  status: "open" | "done" | "skipped" | "event";
  chip: { label: string; cls: string } | null;
  taskId: string | null;
  mine: boolean;
  call: { leadId: string; leadName: string; phone: string | null } | null;
  next: boolean;
};

export type TodoDay = { key: string; label: string; items: { time: string; title: string }[] };

type Rows = { overdue: TodoRow[]; done: TodoRow[]; coming: TodoRow[]; anytime: TodoRow[] };
type Member = { id: string; name: string };

const LATE_SHOWN = 5;
const DAY_ITEMS_SHOWN = 3;

// The to-do list at the top of the Dashboard. Everyone gets their own;
// whoever hands out work also sees the team's, and adds to-dos for anyone.
// It reads top to bottom like the day: late, done, now, coming, any time.
export default function TodoList({
  rows,
  upcoming,
  nowLabel,
  team,
  canAssign,
  members,
  meId,
  freeLeads,
  digestEnabled,
  statusAction,
  callAction,
  createAction,
  searchAction,
  assignAction,
  digestAction,
}: {
  rows: Rows;
  upcoming: TodoDay[];
  nowLabel: string;
  team: boolean;
  canAssign: boolean;
  members: Member[];
  meId: string;
  freeLeads: number;
  digestEnabled: boolean;
  statusAction: (taskId: string, status: "open" | "done" | "skipped") => Promise<void>;
  callAction: (leadId: string, input?: { mode?: string }) => Promise<CallPlan>;
  createAction: (input: TaskDraft & { timezone: string; leadId: string | null }) => Promise<void>;
  searchAction: (q: string) => Promise<{ id: string; name: string; company: string | null }[]>;
  assignAction: (input: { assigneeId: string; count: number; day: "today" | "tomorrow"; timezone: string }) => Promise<{ created: number }>;
  digestAction: (enabled: boolean) => Promise<void>;
}) {
  const [panel, setPanel] = useState<"add" | "handout" | null>(null);
  const [allLate, setAllLate] = useState(false);
  const empty = rows.overdue.length + rows.done.length + rows.coming.length + rows.anytime.length === 0;
  const late = allLate ? rows.overdue : rows.overdue.slice(0, LATE_SHOWN);
  const toggle = (p: "add" | "handout") => setPanel(panel === p ? null : p);

  return (
    <section className="glass-card glass-card-solid flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-medium">To-do</h2>
          {canAssign && (
            <div className="flex rounded-full p-[3px] text-[12.5px]" style={{ background: "var(--surface-2)" }} role="tablist" aria-label="Whose to-dos">
              {(["me", "team"] as const).map((s) => {
                const on = (s === "team") === team;
                return (
                  <Link
                    key={s}
                    href={`/dashboard?todo=${s}`}
                    scroll={false}
                    role="tab"
                    aria-selected={on}
                    className="rounded-full px-3 py-1 font-medium"
                    style={on ? { background: "var(--surface-1)", color: "var(--ink)", boxShadow: "0 0 0 1px var(--hairline)" } : { color: "var(--ink-muted)" }}
                  >
                    {s === "me" ? "Mine" : "Team"}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {canAssign && (
            <button type="button" onClick={() => toggle("handout")} className="btn btn-secondary btn-sm" aria-expanded={panel === "handout"}>
              Hand out leads
            </button>
          )}
          <button type="button" onClick={() => toggle("add")} className="btn btn-primary btn-sm" aria-expanded={panel === "add"}>
            + Add to-do
          </button>
        </div>
      </div>

      {panel === "add" && (
        <div className="px-4 pb-4 sm:px-5">
          <AddTodo members={canAssign ? members : null} meId={meId} createAction={createAction} searchAction={searchAction} onDone={() => setPanel(null)} />
        </div>
      )}
      {panel === "handout" && (
        <div className="mx-4 mb-4 rounded-[14px] sm:mx-5" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
          <QuickAssign embedded members={members} freeLeads={freeLeads} assignAction={assignAction} />
        </div>
      )}

      {empty ? (
        <div className="px-4 pb-5 text-[13.5px] sm:px-5" style={{ color: "var(--ink-muted)" }}>
          Nothing on the list today. {canAssign ? "Add a to-do for someone, or hand out leads to call." : "To-dos you're given show up here on their day."}
        </div>
      ) : (
        <div className="pb-2">
          {late.length > 0 && (
            <Group title="Late" warn>
              {late.map((r) => (
                <Row key={r.key} row={r} statusAction={statusAction} callAction={callAction} />
              ))}
              {rows.overdue.length > LATE_SHOWN && (
                <button type="button" onClick={() => setAllLate(!allLate)} className="px-4 py-2.5 text-left text-[13px] font-medium sm:px-5" style={{ color: "var(--accent-blue)" }}>
                  {allLate ? "Show fewer" : `Show ${rows.overdue.length - LATE_SHOWN} more`}
                </button>
              )}
            </Group>
          )}

          <Group title="Today">
            {rows.done.map((r) => (
              <Row key={r.key} row={r} statusAction={statusAction} callAction={callAction} />
            ))}
            <div className="mx-2 flex items-center gap-3 px-2 py-1.5 sm:px-3" aria-label={`Now, ${nowLabel}`}>
              <span className="w-[56px] flex-none text-right text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--tone-urgent)" }}>{nowLabel}</span>
              <span className="flex-none rounded-full px-2 py-[1px] text-[10.5px] font-semibold uppercase" style={{ letterSpacing: "0.5px", background: "var(--tone-urgent)", color: "#fff" }}>Now</span>
              <span className="h-px flex-1" style={{ background: "var(--tone-urgent)" }} />
            </div>
            {rows.coming.length === 0 ? (
              <div className="mx-2 flex gap-3 px-2 py-2 text-[12.5px] sm:px-3" style={{ color: "var(--ink-muted)" }}>
                <span className="w-[56px] flex-none" />
                <span className="w-[22px] flex-none" />
                <span>Nothing else set for a time today.</span>
              </div>
            ) : (
              rows.coming.map((r) => <Row key={r.key} row={r} statusAction={statusAction} callAction={callAction} />)
            )}
          </Group>

          {rows.anytime.length > 0 && (
            <Group title="Any time today">
              {rows.anytime.map((r) => (
                <Row key={r.key} row={r} statusAction={statusAction} callAction={callAction} />
              ))}
            </Group>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          {upcoming.slice(0, 4).map((d) => (
            <div key={d.key} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 text-[13px]">
              <span className="text-right" style={{ color: "var(--ink-muted)" }}>{d.label}</span>
              <span className="min-w-0 break-words">
                {d.items.slice(0, DAY_ITEMS_SHOWN).map((i, k) => (
                  <span key={k}>
                    {k > 0 && <span style={{ color: "var(--ink-muted)" }}> · </span>}
                    {i.time && <span className="tabular-nums" style={{ color: "var(--ink-muted)" }}>{i.time} </span>}
                    {i.title}
                  </span>
                ))}
                {d.items.length > DAY_ITEMS_SHOWN && <span style={{ color: "var(--ink-muted)" }}> · {d.items.length - DAY_ITEMS_SHOWN} more</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
        <TaskDigestToggle enabled={digestEnabled} action={digestAction} />
      </div>
    </section>
  );
}

function Group({ title, warn, children }: { title: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase sm:px-5" style={{ letterSpacing: "0.6px", color: warn ? "var(--tone-urgent)" : "var(--ink-muted)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ row, statusAction, callAction }: { row: TodoRow; statusAction: (taskId: string, status: "open" | "done" | "skipped") => Promise<void>; callAction: (leadId: string, input?: { mode?: string }) => Promise<CallPlan> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const finished = row.status === "done" || row.status === "skipped";
  const set = (status: "open" | "done" | "skipped") =>
    startTransition(async () => {
      await statusAction(row.taskId!, status);
      router.refresh();
    });
  const inverted = row.next;
  const ink = inverted ? "var(--on-surface-inverted)" : "var(--ink)";
  const muted = inverted ? "var(--on-surface-inverted-muted)" : "var(--ink-muted)";

  const mark =
    row.taskId ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => set(finished ? "open" : "done")}
        aria-label={finished ? `Reopen: ${row.title}` : `Mark done: ${row.title}`}
        className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
        style={finished ? { background: row.status === "done" ? "var(--ink)" : "var(--hairline)", color: "var(--surface-1)" } : { boxShadow: `inset 0 0 0 1.5px ${inverted ? "var(--on-surface-inverted-muted)" : row.late ? "var(--tone-urgent)" : "var(--hairline)"}` }}
      >
        {finished && (
          <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {row.status === "done" ? <path d="M3.5 8.5 6.5 11.5 12.5 5" /> : <path d="M4.5 8h7" />}
          </svg>
        )}
      </button>
    ) : (
      <span aria-hidden className="flex h-[22px] w-[22px] flex-none items-center justify-center" style={{ color: row.kind === "summary" && row.late ? "var(--tone-urgent)" : muted }}>
        {row.kind === "event" ? (
          <svg viewBox="0 0 16 16" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="4" width="9" height="8" rx="2" />
            <path d="m10.5 7 4-2v6l-4-2" />
          </svg>
        ) : row.kind === "call" ? (
          <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2.5h2.5l1.2 3-1.6 1a8 8 0 0 0 4.4 4.4l1-1.6 3 1.2V13a1.5 1.5 0 0 1-1.5 1.5A11.5 11.5 0 0 1 1.5 4 1.5 1.5 0 0 1 3 2.5Z" />
          </svg>
        ) : (
          <span className="h-2 w-2 rounded-full" style={{ background: row.late ? "var(--tone-urgent)" : "var(--tone-due)" }} />
        )}
      </span>
    );

  const title = (
    <span className="break-words text-[14px] font-medium" style={{ color: finished ? "var(--ink-muted)" : ink }}>
      {row.title}
    </span>
  );

  return (
    <div
      className={`mx-2 flex items-start gap-3 rounded-[12px] px-2 py-2.5 sm:px-3 ${inverted ? "my-1" : ""}`}
      style={{ ...(inverted ? { background: "var(--surface-inverted)" } : {}), opacity: pending ? 0.6 : 1 }}
    >
      <span className="w-[56px] flex-none pt-[3px] text-right text-[12.5px] tabular-nums" style={{ color: row.late ? "var(--tone-urgent)" : muted, fontWeight: row.late || inverted ? 500 : undefined }}>
        {row.time ?? ""}
      </span>
      {mark}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {row.href ? (
            row.href.startsWith("http") ? (
              <a href={row.href} target="_blank" rel="noreferrer">{title}</a>
            ) : (
              <Link href={row.href}>{title}</Link>
            )
          ) : (
            title
          )}
          {row.chip && <span className={`chip ${row.chip.cls}`}>{row.chip.label}</span>}
          {row.who && (
            <span className="text-[12px]" style={{ color: muted }}>
              {row.who}
            </span>
          )}
        </div>
        {row.detail && <div className="mt-0.5 break-words text-[12.5px]" style={{ color: muted }}>{row.detail}</div>}
        {/* On a phone the buttons sit under the text. */}
        {!finished && row.taskId && (row.mine || row.next) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
            <Actions row={row} pending={pending} set={set} callAction={callAction} />
          </div>
        )}
      </div>
      {!finished && row.taskId && (row.mine || row.next) && (
        <div className="hidden flex-none items-center gap-1.5 sm:flex">
          <Actions row={row} pending={pending} set={set} callAction={callAction} />
        </div>
      )}
    </div>
  );
}

function Actions({ row, pending, set, callAction }: { row: TodoRow; pending: boolean; set: (s: "open" | "done" | "skipped") => void; callAction: (leadId: string, input?: { mode?: string }) => Promise<CallPlan> }) {
  return (
    <>
      {row.call?.phone && <LeadCallButton variant="compact" primary={row.next} leadName={row.call.leadName} startAction={(input) => callAction(row.call!.leadId, input)} />}
      <button type="button" disabled={pending} onClick={() => set("skipped")} className="btn btn-ghost btn-sm" style={row.next ? { color: "var(--on-surface-inverted-muted)" } : undefined}>
        Skip
      </button>
    </>
  );
}

// "+ Add to-do": what, for whom, which lead (optional for an Other to-do),
// which day.
function AddTodo({
  members,
  meId,
  createAction,
  searchAction,
  onDone,
}: {
  members: Member[] | null;
  meId: string;
  createAction: (input: TaskDraft & { timezone: string; leadId: string | null }) => Promise<void>;
  searchAction: (q: string) => Promise<{ id: string; name: string; company: string | null }[]>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TaskDraft>({ assigneeId: meId, type: "cold_call", dueDate: todayLocal(), dueTime: "", priority: "normal", note: "" });
  const [lead, setLead] = useState<{ id: string; name: string; company: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; company: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (lead || query.trim().length < 2) return;
    timer.current = setTimeout(() => {
      searchAction(query.trim())
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, lead, searchAction]);

  // Old matches don't linger once the search is cleared or a lead is picked.
  const shown = lead || query.trim().length < 2 ? [] : results;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lead && draft.type !== "other") return setError("Pick a lead, or make it an Other to-do");
    if (!lead && !draft.note.trim()) return setError("Write what needs doing");
    startTransition(async () => {
      try {
        await createAction({ ...draft, timezone: viewerTimeZone(), leadId: lead?.id ?? null });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add the to-do");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-[14px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>Lead {draft.type === "other" ? "(optional)" : ""}</span>
        {lead ? (
          <div className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2" style={{ border: "1px solid var(--hairline)" }}>
            <span className="min-w-0 truncate text-[13.5px]">
              <span className="font-medium">{lead.name}</span>
              {lead.company && <span style={{ color: "var(--ink-muted)" }}> · {lead.company}</span>}
            </span>
            <button type="button" onClick={() => setLead(null)} className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or company" className="input w-full" autoComplete="off" disabled={pending} />
            {shown.length > 0 && (
              <div className="mt-1 overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
                {shown.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setLead(r);
                      setQuery("");
                    }}
                    className="row-hover block w-full px-3 py-2 text-left text-[13.5px]"
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.company && <span style={{ color: "var(--ink-muted)" }}> · {r.company}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </label>
      <TaskFields draft={draft} setDraft={setDraft} assignees={members} disabled={pending} />
      {error && <div className="chip chip-warn w-fit max-w-full whitespace-normal px-3 py-1.5 text-[12.5px]">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Adding…" : "Add to-do"}
        </button>
        <button type="button" disabled={pending} onClick={onDone} className="btn btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
