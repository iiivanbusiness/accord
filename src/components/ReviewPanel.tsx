"use client";

import { useState, useTransition } from "react";
import SentConfirmationCard from "./SentConfirmationCard";

type ChecklistItem = { id: string; label: string; done: boolean };
type Comment = { id: string; authorName: string; authorEmail: string; body: string; createdAt: string };
type ReviewStepItem = {
  id: string;
  order: number;
  status: string; // pending | approved | rejected
  assigneeId: string;
  assigneeName: string;
  decidedByName: string | null;
  decidedOnBehalfOfName: string | null;
  decidedAt: Date | null;
  note: string | null;
  priority: string; // low | normal | high | urgent
  dueAt: Date | null;
  checklistItems: ChecklistItem[];
  comments: Comment[];
};
type TeammateOption = { id: string; name: string };

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Row = { step: ReviewStepItem; kind: "done" | "active" | "upcoming" };

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="#fff" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.5" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Persistent review status card for the Deal page's sidebar — always
// visible once a contract exists, not just while a chain-triggered review
// happens to be in flight. "Send to" is the manual override: it always
// works, even mid-chain, by reassigning whatever step is currently active
// (or starting a fresh one if nothing is). The chain (configured in
// Settings) is just the default that fires this same underlying state on
// "Send to client" — this panel doesn't care which path created it.
export default function ReviewPanel({
  dealId,
  contractStatus,
  dealStatus,
  steps,
  teammates,
  currentUserId,
  currentUserEmail,
  delegatedAssigneeIds,
  currentUserCanManageWorkspace,
  sendToAction,
  decideAction,
  addChecklistItemAction,
  toggleChecklistItemAction,
  removeChecklistItemAction,
  addCommentAction,
  deleteCommentAction,
  updateStepMetaAction,
}: {
  dealId: string;
  contractStatus: string;
  dealStatus: string;
  steps: ReviewStepItem[];
  teammates: TeammateOption[];
  currentUserId: string;
  currentUserEmail: string;
  delegatedAssigneeIds: string[];
  currentUserCanManageWorkspace: boolean;
  sendToAction: (dealId: string, assigneeId: string) => Promise<void>;
  decideAction: (dealId: string, reviewStepId: string, decision: "approve" | "reject", formData: FormData) => Promise<void>;
  addChecklistItemAction: (dealId: string, reviewStepId: string, formData: FormData) => Promise<void>;
  toggleChecklistItemAction: (dealId: string, itemId: string, done: boolean) => Promise<void>;
  removeChecklistItemAction: (dealId: string, itemId: string) => Promise<void>;
  addCommentAction: (dealId: string, reviewStepId: string, body: string) => Promise<void>;
  deleteCommentAction: (dealId: string, commentId: string) => Promise<void>;
  updateStepMetaAction: (dealId: string, reviewStepId: string, formData: FormData) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [sendToId, setSendToId] = useState(teammates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [justSentTo, setJustSentTo] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [isPending, startTransition] = useTransition();

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const activeStep = sorted.find((s) => s.status === "pending") ?? null;
  const rows: Row[] = sorted.map((step) => ({
    step,
    kind: step.status !== "pending" ? "done" : step.id === activeStep?.id ? "active" : "upcoming",
  }));
  const mostRecentDecided = [...sorted].filter((s) => s.status !== "pending").sort((a, b) => b.order - a.order)[0] ?? null;

  const actingAsDelegate = Boolean(activeStep && delegatedAssigneeIds.includes(activeStep.assigneeId));
  const canDecideCurrent = Boolean(activeStep && (activeStep.assigneeId === currentUserId || actingAsDelegate));
  const canEditMeta = Boolean(activeStep && (canDecideCurrent || currentUserCanManageWorkspace));

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  // A dedicated transition (and an explicit "sent!" payoff, same pattern as
  // the voice-correction confirmation) instead of just `run` — clicking
  // this was previously indistinguishable from doing nothing, since the
  // panel's own re-render is the only other signal that anything happened.
  function sendTo() {
    if (!sendToId) return;
    const recipientName = teammates.find((t) => t.id === sendToId)?.name ?? "them";
    setError(null);
    startSending(async () => {
      try {
        await sendToAction(dealId, sendToId);
        setJustSentTo(recipientName);
        setTimeout(() => setJustSentTo(null), 2200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function decide(decision: "approve" | "reject") {
    if (!activeStep) return;
    run(async () => {
      const formData = new FormData();
      formData.set("note", note);
      await decideAction(dealId, activeStep.id, decision, formData);
      setNote("");
    });
  }

  function addItem() {
    if (!activeStep || !newItemLabel.trim()) return;
    run(async () => {
      const formData = new FormData();
      formData.set("label", newItemLabel.trim());
      await addChecklistItemAction(dealId, activeStep.id, formData);
      setNewItemLabel("");
    });
  }

  function addComment() {
    if (!activeStep || !commentDraft.trim()) return;
    run(async () => {
      await addCommentAction(dealId, activeStep.id, commentDraft.trim());
      setCommentDraft("");
    });
  }

  function updatePriority(value: string) {
    if (!activeStep) return;
    run(async () => {
      const formData = new FormData();
      formData.set("priority", value);
      formData.set("dueAt", activeStep.dueAt ? activeStep.dueAt.toISOString().slice(0, 10) : "");
      await updateStepMetaAction(dealId, activeStep.id, formData);
    });
  }

  const phaseLabel =
    dealStatus === "signed"
      ? "Signed"
      : contractStatus === "sent"
        ? "Sent to client"
        : activeStep
          ? `With ${activeStep.assigneeName}`
          : mostRecentDecided?.status === "rejected"
            ? "Changes requested"
            : "Not sent for review";
  const phaseChip =
    dealStatus === "signed" || contractStatus === "sent"
      ? "chip-success"
      : activeStep
        ? "chip-active"
        : mostRecentDecided?.status === "rejected"
          ? "chip-warn"
          : "chip-neutral";

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Review</h2>
        <span className={`chip ${phaseChip}`} style={{ fontSize: 11 }}>{phaseLabel}</span>
      </div>

      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {justSentTo ? (
        <SentConfirmationCard title={`Sent to ${justSentTo} for review`} />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="flex flex-col">
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1;
                const timeLabel =
                  row.kind === "done"
                    ? row.step.decidedAt ? formatDate(row.step.decidedAt) : ""
                    : row.kind === "active"
                      ? "now"
                      : "next";
                return (
                  <div key={row.step.id} className="flex gap-2.5">
                    <div
                      className="flex-none pt-[3px] text-right text-[11px] font-medium"
                      style={{ width: 32, color: row.kind === "active" ? "var(--accent-blue)" : "var(--ink-muted)" }}
                    >
                      {timeLabel}
                    </div>

                    <div className="flex flex-none flex-col items-center" style={{ width: 18 }}>
                      <span
                        className="flex flex-none items-center justify-center rounded-full text-[10px] font-bold"
                        style={
                          row.kind === "done"
                            ? { width: 18, height: 18, background: row.step.status === "approved" ? "var(--accent-blue)" : "#c0392b", color: "#fff" }
                            : row.kind === "active"
                              ? { width: 10, height: 10, marginTop: 4, border: "2px solid var(--accent-blue)", background: "var(--surface-1)" }
                              : { width: 8, height: 8, marginTop: 5, border: "1.5px solid var(--hairline)", background: "transparent" }
                        }
                      >
                        {row.kind === "done" ? (row.step.status === "approved" ? "✓" : "✕") : null}
                      </span>
                      {!isLast && (
                        <div className="w-0 flex-1" style={{ minHeight: 14, borderLeft: "1.5px dashed var(--hairline)" }} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 pb-5">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span
                          className="text-[13px] font-medium"
                          style={
                            row.kind === "upcoming"
                              ? { color: "var(--ink-muted)" }
                              : row.kind === "done"
                                ? { color: "var(--ink-muted)", textDecoration: "line-through" }
                                : undefined
                          }
                        >
                          {row.step.assigneeName}
                        </span>
                        <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                          {row.kind === "done"
                            ? row.step.status === "approved" ? "approved" : "requested changes"
                            : row.kind === "active"
                              ? "reviewing now"
                              : "up next"}
                        </span>
                      </div>

                      {row.kind === "active" && (
                        <div className="mt-2.5 flex min-w-0 flex-col gap-3">
                          {actingAsDelegate && (
                            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                              You&apos;re acting as a review backup, not directly as {activeStep!.assigneeName}.
                            </div>
                          )}

                          {canEditMeta && (
                            <select
                              value={activeStep!.priority}
                              onChange={(e) => updatePriority(e.target.value)}
                              disabled={isPending}
                              className="input w-full"
                              style={{ fontSize: "12px", padding: "5px 8px" }}
                            >
                              <option value="low">Low priority</option>
                              <option value="normal">Normal priority</option>
                              <option value="high">High priority</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          )}

                          <div className="flex flex-col gap-1.5">
                            {activeStep!.checklistItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.done}
                                  disabled={!canDecideCurrent || isPending}
                                  onChange={(e) => run(() => toggleChecklistItemAction(dealId, item.id, e.target.checked))}
                                />
                                <span className="flex-1 text-[13px]" style={item.done ? { color: "var(--ink-muted)", textDecoration: "line-through" } : undefined}>
                                  {item.label}
                                </span>
                                {canDecideCurrent && (
                                  <button type="button" disabled={isPending} onClick={() => run(() => removeChecklistItemAction(dealId, item.id))} className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {canDecideCurrent && (
                            <div className="flex gap-2">
                              <input
                                value={newItemLabel}
                                onChange={(e) => setNewItemLabel(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                                placeholder="Add a checklist item…"
                                disabled={isPending}
                                className="input flex-1"
                                style={{ fontSize: "12.5px", padding: "6px 9px" }}
                              />
                              <button type="button" disabled={isPending || !newItemLabel.trim()} onClick={addItem} className="btn btn-secondary btn-sm">
                                Add
                              </button>
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            {activeStep!.comments.map((c) => (
                              <div key={c.id} className="rounded-[8px] px-2.5 py-2" style={{ background: "var(--surface-1)" }}>
                                <div className="mb-0.5 flex items-center justify-between gap-2">
                                  <span className="text-[12px] font-medium">{c.authorName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10.5px]" style={{ color: "var(--ink-muted)" }}>{timeAgo(c.createdAt)}</span>
                                    {c.authorEmail === currentUserEmail && (
                                      <button type="button" disabled={isPending} onClick={() => run(() => deleteCommentAction(dealId, c.id))} className="text-[10.5px]" style={{ color: "var(--ink-muted)" }}>
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[12.5px] leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{c.body}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <textarea
                              value={commentDraft}
                              onChange={(e) => setCommentDraft(e.target.value)}
                              placeholder="Leave a comment…"
                              rows={2}
                              disabled={isPending}
                              className="input flex-1"
                              style={{ fontSize: "12.5px", padding: "6px 9px" }}
                            />
                            <button type="button" disabled={isPending || !commentDraft.trim()} onClick={addComment} className="btn btn-secondary btn-sm self-end">
                              Post
                            </button>
                          </div>

                          {canDecideCurrent && (
                            <div>
                              <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note (optional)"
                                rows={2}
                                className="input mb-2.5 w-full"
                                style={{ fontSize: "13px", padding: "8px 11px" }}
                              />
                              <button type="button" disabled={isPending} onClick={() => decide("approve")} className="btn btn-primary w-full justify-center">
                                {isPending ? "Working…" : "✓ Mark as done"}
                              </button>
                              <button type="button" disabled={isPending} onClick={() => decide("reject")} className="mt-2 w-full text-center text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                                {isPending ? "Working…" : "Request changes instead"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {teammates.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full p-1.5" style={{ background: "var(--surface-2)" }}>
              <select
                value={sendToId}
                onChange={(e) => setSendToId(e.target.value)}
                disabled={isSending}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium outline-none"
                style={{ padding: "6px 8px", color: "var(--ink)" }}
              >
                {teammates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                type="button"
                disabled={isSending || !sendToId}
                onClick={sendTo}
                aria-label="Send for review"
                className="flex flex-none items-center justify-center rounded-full"
                style={{ width: 30, height: 30, background: "var(--accent-blue)", opacity: isSending || !sendToId ? 0.6 : 1 }}
              >
                {isSending ? <Spinner /> : <SendIcon />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
