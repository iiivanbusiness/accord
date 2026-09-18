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
type TeammateOption = { id: string; name: string };

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
  const [isPending, startTransition] = useTransition();

  const activeStep = steps.find((s) => s.status === "pending") ?? null;
  const history = steps.filter((s) => s.status !== "pending").sort((a, b) => b.order - a.order);
  const mostRecentDecided = history[0] ?? null;

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

  function sendTo() {
    if (!sendToId) return;
    run(() => sendToAction(dealId, sendToId));
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

  function updateMeta(field: "priority" | "dueAt", value: string) {
    if (!activeStep) return;
    run(async () => {
      const formData = new FormData();
      formData.set("priority", field === "priority" ? value : activeStep.priority);
      formData.set("dueAt", field === "dueAt" ? value : activeStep.dueAt ? activeStep.dueAt.toISOString().slice(0, 10) : "");
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
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Review</h2>
        <span className={`chip ${phaseChip}`} style={{ fontSize: 11 }}>{phaseLabel}</span>
      </div>

      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {teammates.length > 0 && (
        <div className="flex gap-2">
          <select
            value={sendToId}
            onChange={(e) => setSendToId(e.target.value)}
            disabled={isPending}
            className="input flex-1"
            style={{ fontSize: "12.5px", padding: "7px 9px" }}
          >
            {teammates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" disabled={isPending || !sendToId} onClick={sendTo} className="btn btn-secondary btn-sm flex-none">
            Send to
          </button>
        </div>
      )}

      {activeStep && (
        <div className="flex flex-col gap-3 rounded-[10px] px-3.5 py-3" style={{ background: "var(--canvas)" }}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10.5px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
              {initials(activeStep.assigneeName)}
            </span>
            <span className="text-[13px] font-medium">{activeStep.assigneeName}</span>
          </div>

          {actingAsDelegate && (
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              You&apos;re acting as a review backup, not directly as {activeStep.assigneeName}.
            </div>
          )}

          {canEditMeta && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeStep.priority}
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
                value={activeStep.dueAt ? activeStep.dueAt.toISOString().slice(0, 10) : ""}
                onChange={(e) => updateMeta("dueAt", e.target.value)}
                disabled={isPending}
                className="input"
                style={{ fontSize: "12px", padding: "5px 8px", width: "auto" }}
              />
            </div>
          )}
          {!canEditMeta && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeStep.priority !== "normal" && <span className={`chip ${PRIORITY_CHIP[activeStep.priority]}`} style={{ fontSize: 11 }}>{PRIORITY_LABEL[activeStep.priority]}</span>}
              {activeStep.dueAt && (
                <span className={`chip ${daysUntil(activeStep.dueAt) < 0 ? "chip-warn" : "chip-neutral"}`} style={{ fontSize: 11 }}>
                  {daysUntil(activeStep.dueAt) >= 0 ? `${daysUntil(activeStep.dueAt)}d left` : "Past due"}
                </span>
              )}
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>Checklist</div>
            <div className="flex flex-col gap-1.5">
              {activeStep.checklistItems.map((item) => (
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
              {activeStep.checklistItems.length === 0 && (
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
              {activeStep.comments.map((c) => (
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
              {activeStep.comments.length === 0 && (
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

      {history.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>History</div>
          <div className="flex flex-col gap-1.5">
            {history.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
                <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-semibold" style={{ background: s.status === "approved" ? "var(--accent-blue)" : "#c0392b", color: "#fff" }}>
                  {s.status === "approved" ? "✓" : "✕"}
                </span>
                <span>{s.assigneeName} {s.status === "approved" ? "approved" : "requested changes"}{s.decidedAt ? ` · ${formatDate(s.decidedAt)}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
