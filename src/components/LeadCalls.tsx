"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LocalDateTime from "@/components/LocalDateTime";
import LeadJoinPicker, { type JoinPick } from "@/components/LeadJoinPicker";
import { CALL_OUTCOME_CHIP, CALL_OUTCOME_LABEL } from "@/lib/call-outcomes";
import { LEAD_STAGE_LABEL } from "@/lib/lead-stages";
import { formatTaskDue, TASK_TYPE_LABEL } from "@/lib/tasks";
import type { ColdCallSummary } from "@/lib/cold-call";

export type LeadCall = {
  id: string;
  at: string; // ISO
  who: string | null;
  outcome: string | null;
  summary: string | null;
  notes: string | null;
  transcript: string | null;
  source: string;
};

export function noteLines(notes: string): string[] {
  return notes.split(/\n|\\n/).map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
}

export function CopyButton({ text, label = "Copy", className = "text-[12px] font-medium" }: { text: () => string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text())
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className={className}
      style={{ color: "var(--accent-blue)" }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Everything on file for the client, oldest call first, ready to paste
// into an email or a report.
export function allNotesText(lead: { name: string; company: string | null }, overview: string | null, calls: LeadCall[]): string {
  const head = [lead.company ? `${lead.name}, ${lead.company}` : lead.name];
  if (overview) head.push("", "Where things stand", ...noteLines(overview).map((l) => `- ${l}`));
  const blocks = [...calls].reverse().map((c) =>
    [day(c.at), c.summary, ...(c.notes ? noteLines(c.notes).map((l) => `- ${l}`) : [])].filter(Boolean).join("\n"),
  );
  return [head.join("\n"), ...blocks].join("\n\n");
}

// The call's write-up, one point a line, with a copy button for sending it on.
function CallNotes({ notes }: { notes: string }) {
  const lines = noteLines(notes);
  return (
    <div className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--canvas)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase" style={{ letterSpacing: "0.5px", color: "var(--ink-muted)" }}>Notes</span>
        <CopyButton text={() => lines.map((l) => `- ${l}`).join("\n")} />
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-snug">
        {lines.map((l, i) => (
          <li key={i} className="break-words">{l}</li>
        ))}
      </ul>
    </div>
  );
}

function describe(r: ColdCallSummary): string {
  const parts = [`Logged as ${CALL_OUTCOME_LABEL[r.outcome] ?? r.outcome}.`];
  if (r.stage) parts.push(`Lead moved to ${LEAD_STAGE_LABEL[r.stage] ?? r.stage}.`);
  if (r.closedTask) parts.push(`Your ${(TASK_TYPE_LABEL[r.closedTask] ?? "task").toLowerCase()} task is marked done.`);
  if (r.followUp) {
    const kind = (TASK_TYPE_LABEL[r.followUp.type] ?? "task").toLowerCase();
    parts.push(`Added a ${kind} for ${formatTaskDue(new Date(`${r.followUp.date}T00:00:00Z`), r.followUp.time)}.`);
  }
  return parts.join(" ");
}

// The lead's call history, plus "Add transcript": paste a cold call and
// the lead updates itself from what was said. A call on the wrong lead can
// be moved to the right one.
export default function LeadCalls({
  lead,
  overview,
  calls,
  processAction,
  searchLeads,
  moveAction,
}: {
  lead: { name: string; company: string | null };
  overview: string | null;
  calls: LeadCall[];
  processAction: (transcript: string) => Promise<ColdCallSummary>;
  searchLeads: (q: string) => Promise<JoinPick[]>;
  moveAction: (callId: string, leadId: string) => Promise<{ leadId: string }>;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (text.trim().split(/\s+/).length < 15) return setError("Paste the whole call. That's too short to be a transcript.");
    startTransition(async () => {
      try {
        const result = await processAction(text);
        // After an await, updates need their own transition to land together
        // with the refreshed lead (sent back by the action's revalidatePath).
        startTransition(() => {
          setNotice(describe(result));
          setText("");
          setAdding(false);
        });
      } catch (err) {
        setError(err instanceof Error && err.message && !err.message.includes("digest") ? `${err.message}.` : "Couldn't read that call. Try again.");
      }
    });
  }

  return (
    <div className="card flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[14px] font-medium">
          Calls{calls.length > 1 && <span className="font-normal" style={{ color: "var(--ink-muted)" }}> · {calls.length}</span>}
        </div>
        <div className="flex items-center gap-3">
          {calls.some((c) => c.notes || c.summary) && <CopyButton text={() => allNotesText(lead, overview, calls)} label="Copy all notes" className="text-[12.5px] font-medium" />}
          {!adding && (
            <button type="button" onClick={() => { setAdding(true); setNotice(null); }} className="btn btn-secondary btn-sm">
              + Add transcript
            </button>
          )}
        </div>
      </div>

      {notice && <div className="chip chip-success w-full justify-start whitespace-normal px-3 py-2 text-[12.5px] leading-snug" role="status">{notice}</div>}

      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="input"
            disabled={pending}
            placeholder={"Paste the cold call transcript here.\n\nRep: Hi, is this Dana?\nDana: Speaking..."}
            aria-label="Call transcript"
          />
          <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
            SealMe reads the call and updates this lead: interest, pain points, objections, next step and stage. Your call task on this lead is marked done.
          </div>
          {error && <div className="chip chip-warn w-full justify-start whitespace-normal px-3 py-2 text-[12.5px]">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Reading the call…" : "Process call"}</button>
            <button type="button" disabled={pending} onClick={() => { setAdding(false); setError(null); }} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {calls.length === 0 && !adding && <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No calls yet.</div>}
      {calls.length > 0 && (
        <div className="flex flex-col">
          {calls.map((c, i) => (
            <div key={c.id} className="flex flex-col gap-1.5 py-3" style={i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                {c.outcome && <span className={`chip ${CALL_OUTCOME_CHIP[c.outcome] ?? "chip-neutral"}`}>{CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome}</span>}
                <span>
                  <LocalDateTime iso={c.at} options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                  {c.who ? ` · ${c.who}` : ""}
                </span>
                {moving !== c.id && (
                  <button type="button" onClick={() => setMoving(c.id)} className="ml-auto text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                    Move to another lead
                  </button>
                )}
              </div>
              {moving === c.id && (
                <LeadJoinPicker
                  search={searchLeads}
                  newOption="+ New lead from this call"
                  confirmText={(pick) => (pick === "new" ? "Move this call to a new lead, filled in from the call?" : `Move this call to ${pick.name}${pick.company ? ` at ${pick.company}` : ""}?`)}
                  confirmLabel="Move call"
                  onConfirm={async (pick) => {
                    const { leadId } = await moveAction(c.id, pick === "new" ? "new" : pick.id);
                    router.push(`/leads/${leadId}`);
                  }}
                  onCancel={() => setMoving(null)}
                />
              )}
              {c.summary && <div className="break-words text-[13px]">{c.summary}</div>}
              {c.notes && <CallNotes notes={c.notes} />}
              {c.transcript && (
                <details className="text-[12.5px]">
                  <summary className="cursor-pointer select-none" style={{ color: "var(--ink-muted)" }}>Transcript</summary>
                  <div className="mt-2 max-h-[320px] overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] p-3" style={{ background: "var(--canvas)" }}>
                    {c.transcript}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
