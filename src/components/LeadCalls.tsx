"use client";

import { useState, useTransition } from "react";
import LocalDateTime from "@/components/LocalDateTime";
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
  transcript: string | null;
  source: string;
};

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
// the lead updates itself from what was said.
export default function LeadCalls({
  calls,
  processAction,
}: {
  calls: LeadCall[];
  processAction: (transcript: string) => Promise<ColdCallSummary>;
}) {
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
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px] font-medium">Calls</div>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setNotice(null); }} className="btn btn-secondary btn-sm">
            + Add transcript
          </button>
        )}
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
              </div>
              {c.summary && <div className="break-words text-[13px]">{c.summary}</div>}
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
