"use client";

import { useState, useTransition } from "react";

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

const PRIORITY_CHIP: Record<string, string> = { low: "chip-neutral", normal: "chip-active", high: "chip-warn", urgent: "chip-danger" };
const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

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

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function ReviewStepper({
  dealId,
  steps,
  currentUserId,
  currentUserEmail,
  delegatedAssigneeIds,
  currentUserCanManageWorkspace,
  decideAction,
  addChecklistItemAction,
  toggleChecklistItemAction,
  removeChecklistItemAction,
  addCommentAction,
  deleteCommentAction,
  updateStepMetaAction,
}: {
  dealId: string;
  steps: ReviewStepItem[];
  currentUserId: string;
  currentUserEmail: string;
  delegatedAssigneeIds: string[];
  currentUserCanManageWorkspace: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStep = steps.find((s) => s.status === "pending");
  const actingAsDelegate = Boolean(currentStep && delegatedAssigneeIds.includes(currentStep.assigneeId));
  const canDecideCurrent = Boolean(currentStep && (currentStep.assigneeId === currentUserId || actingAsDelegate));
  const canEditMeta = Boolean(currentStep && (canDecideCurrent || currentUserCanManageWorkspace));

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

  function decide(decision: "approve" | "reject") {
    if (!currentStep) return;
    run(async () => {
      const formData = new FormData();
      formData.set("note", note);
      await decideAction(dealId, currentStep.id, decision, formData);
      setNote("");
    });
  }

  function addItem() {
    if (!currentStep || !newItemLabel.trim()) return;
    run(async () => {
      const formData = new FormData();
      formData.set("label", newItemLabel.trim());
      await addChecklistItemAction(dealId, currentStep.id, formData);
      setNewItemLabel("");
    });
  }

  function addComment() {
    if (!currentStep || !commentDraft.trim()) return;
    run(async () => {
      await addCommentAction(dealId, currentStep.id, commentDraft.trim());
      setCommentDraft("");
    });
  }

  function updateMeta(field: "priority" | "dueAt", value: string) {
    if (!currentStep) return;
    run(async () => {
      const formData = new FormData();
      formData.set("priority", field === "priority" ? value : currentStep.priority);
      formData.set("dueAt", field === "dueAt" ? value : currentStep.dueAt ? currentStep.dueAt.toISOString().slice(0, 10) : "");
      await updateStepMetaAction(dealId, currentStep.id, formData);
    });
  }

  return (
    <div className="card mb-[18px]">
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Review</h2>
      </div>
      <div className="px-5 py-2">
        {error && (
          <div className="my-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
            {error}
          </div>
        )}
        {steps.map((s) => (
          <div key={s.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
            <div className="flex items-start justify-between gap-3.5">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10.5px] font-semibold"
                  style={{
                    background: s.status === "approved" ? "var(--accent-blue)" : s.status === "rejected" ? "#c0392b" : "var(--surface-2)",
                    color: s.status === "pending" ? "var(--ink)" : "#fff",
                  }}
                >
                  {s.status === "approved" ? "✓" : s.status === "rejected" ? "✕" : initials(s.assigneeName)}
                </span>
                <div>
                  <div className="text-[13.5px] font-medium">{s.assigneeName}</div>
                  {s.decidedByName && (
                    <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                      {s.status === "approved" ? "Approved" : "Rejected"} by {s.decidedByName}
                      {s.decidedOnBehalfOfName ? ` (on behalf of ${s.decidedOnBehalfOfName})` : ""}
                      {s.decidedAt ? ` · ${formatDate(s.decidedAt)}` : ""}
                    </div>
                  )}
                  {s.note && (
                    <div className="mt-1 text-[12px] italic" style={{ color: "var(--ink-muted)" }}>&ldquo;{s.note}&rdquo;</div>
                  )}
                </div>
              </div>
              {s.status === "pending" && s.id !== currentStep?.id && <span className="chip chip-neutral flex-none" style={{ fontSize: 11 }}>Waiting</span>}
              {s.id === currentStep?.id && (
                <div className="flex flex-none items-center gap-1.5">
                  {s.priority !== "normal" && <span className={`chip ${PRIORITY_CHIP[s.priority]}`} style={{ fontSize: 11 }}>{PRIORITY_LABEL[s.priority]}</span>}
                  {s.dueAt && (
                    <span className={`chip ${daysUntil(s.dueAt) < 0 ? "chip-warn" : "chip-neutral"}`} style={{ fontSize: 11 }}>
                      {daysUntil(s.dueAt) >= 0 ? `${daysUntil(s.dueAt)}d left` : "Past due"}
                    </span>
                  )}
                </div>
              )}
            </div>

            {s.id === currentStep?.id && (
              <div className="mt-3 flex flex-col gap-3 rounded-[10px] px-3.5 py-3" style={{ background: "var(--canvas)" }}>
                {actingAsDelegate && (
                  <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    You&apos;re acting as a review backup, not directly as {s.assigneeName}.
                  </div>
                )}

                {canEditMeta && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={s.priority}
                      onChange={(e) => updateMeta("priority", e.target.value)}
                      disabled={isPending}
                      className="input"
                      style={{ fontSize: "12px", padding: "5px 8px", width: "auto" }}
                    >
                      <option value="low">Low priority</option>
                      <option value="normal">Normal priority</option>
                      <option value="high">High priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <input
                      type="date"
                      value={s.dueAt ? s.dueAt.toISOString().slice(0, 10) : ""}
                      onChange={(e) => updateMeta("dueAt", e.target.value)}
                      disabled={isPending}
                      className="input"
                      style={{ fontSize: "12px", padding: "5px 8px", width: "auto" }}
                    />
                  </div>
                )}

                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Checklist</div>
                  <div className="flex flex-col gap-1.5">
                    {s.checklistItems.map((item) => (
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
                    {s.checklistItems.length === 0 && (
                      <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No checklist items yet.</div>
                    )}
                  </div>
                  {canDecideCurrent && (
                    <div className="mt-2 flex gap-2">
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
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Comments</div>
                  <div className="flex flex-col gap-2">
                    {s.comments.map((c) => (
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
                    {s.comments.length === 0 && (
                      <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>No comments yet.</div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
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
                      ✓ Mark as done
                    </button>
                    <button type="button" disabled={isPending} onClick={() => decide("reject")} className="mt-2 w-full text-center text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                      Request changes instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
