"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DealTermsCard from "./DealTermsCard";
import ContinueCallButton from "./ContinueCallButton";
import ActionItemsCard from "./ActionItemsCard";
import CallHighlightsOverlay from "./CallHighlightsOverlay";
import SendToDocusignButton from "./SendToDocusignButton";
import VoiceCorrectionButton from "./VoiceCorrectionButton";
import DealNotes from "./DealNotes";
import ReviewPanel from "./ReviewPanel";

const POLL_INTERVAL_MS = 4000;

type FieldChange = { oldValue: string | null; newValue: string | null; changedBy: string; changedAt: Date };
type FieldItem = { id: string; groupLabel: string; label: string; value: string | null; status: string; sourceQuote: string | null; history: FieldChange[] };
type CallItem = { id: string; source: string; startedAt: Date; endedAt: Date | null; transcript: string };
type ActionItemT = { id: string; description: string; ownerType: string; dueDate: Date | null; status: string; sourceQuote: string | null };
type CallHighlightItem = { id: string; type: string; body: string; sourceQuote: string | null };

type LiveDealState = {
  status: string;
  summary: string | null;
  fields: FieldItem[];
  calls: CallItem[];
  actionItems: ActionItemT[];
  callHighlights: CallHighlightItem[];
};

type ReviewStepItem = {
  id: string;
  order: number;
  status: string;
  assigneeId: string;
  assigneeName: string;
  decidedByName: string | null;
  decidedOnBehalfOfName: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  note: string | null;
  priority: string;
  dueAt: Date | null;
  checklistItems: { id: string; label: string; done: boolean }[];
  comments: { id: string; authorName: string; authorEmail: string; body: string; createdAt: string }[];
};
type TeammateOption = { id: string; name: string };
type NoteItem = { id: string; authorName: string; authorEmail: string; body: string; createdAt: string };

const CALL_SOURCE_LABEL: Record<string, string> = {
  local: "Recorded locally",
  upload: "Pasted transcript",
};

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  extraction_failed: "Couldn't process call",
  ready: "Ready for review",
  pending_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  sent: "Sent - awaiting signature",
  signed: "Signed",
};

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  extraction_failed: "chip-warn",
  ready: "chip-active",
  pending_approval: "chip-neutral",
  changes_requested: "chip-warn",
  sent: "chip-neutral",
  signed: "chip-success",
};

function callPreview(transcript: string): string {
  const clean = transcript.trim().replace(/\s+/g, " ");
  return clean.length > 160 ? `${clean.slice(0, 160)}…` : clean || "No transcript captured.";
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// A call still being recorded (local capture or a live Recall bot) writes
// new extracted terms/summary/action items to the DB every ~minute in the
// background — see src/app/api/local-capture/transcribe/route.ts. Server
// components only render once per navigation, so without this, the page a
// rep is actually watching mid-call would just sit there showing the state
// from whenever it first loaded, no matter how much the AI has extracted
// since — the rep would have to leave and re-enter to see anything new.
// This polls a lean snapshot of just the live-relevant fields (same
// pattern as ReviewPanel's review-state polling) and stops once the call
// is over and the deal has left "processing".
export default function LiveDealView({
  dealId,
  clientName,
  service,
  callLength,
  contractViewedAt,
  templateName,
  hasContract,
  initialStatus,
  initialSummary,
  initialFields,
  initialCalls,
  initialActionItems,
  initialCallHighlights,
  getLiveDealStateAction,
  updateFieldsAction,
  retryExtractionAction,
  fillMissingFieldsAction,
  generateContractAction,
  toggleActionItemAction,
  notes,
  currentUserEmail,
  addNoteAction,
  deleteNoteAction,
  applyVoiceFieldCorrectionAction,
  sendForReviewToAction,
  docusignEnabled,
  contractIsDraft: initialContractIsDraft,
  clientHasEmail,
  sendViaDocusignNowAction,
  reviewPanel,
}: {
  dealId: string;
  clientName: string;
  service: string;
  callLength: string | null;
  contractViewedAt: Date | null;
  templateName: string | null;
  hasContract: boolean;
  initialStatus: string;
  initialSummary: string | null;
  initialFields: FieldItem[];
  initialCalls: CallItem[];
  initialActionItems: ActionItemT[];
  initialCallHighlights: CallHighlightItem[];
  getLiveDealStateAction: (dealId: string) => Promise<LiveDealState | null>;
  updateFieldsAction: (formData: FormData) => void;
  retryExtractionAction: () => void;
  fillMissingFieldsAction: (formData: FormData) => void;
  generateContractAction: () => void;
  toggleActionItemAction: (dealId: string, itemId: string) => Promise<{ error?: string }>;
  notes: NoteItem[];
  currentUserEmail: string;
  addNoteAction: (dealId: string, body: string) => Promise<{ error?: string }>;
  deleteNoteAction: (dealId: string, noteId: string) => Promise<{ error?: string }>;
  applyVoiceFieldCorrectionAction: (dealId: string, fieldKey: string, newValue: string) => Promise<void>;
  sendForReviewToAction: (dealId: string, assigneeId: string) => Promise<{ error?: string }>;
  docusignEnabled: boolean;
  contractIsDraft: boolean;
  clientHasEmail: boolean;
  sendViaDocusignNowAction: (dealId: string) => Promise<{ error?: string }>;
  reviewPanel: {
    initialContractStatus: string;
    initialContractCreatedAt: Date;
    initialContractSentAt: Date | null;
    initialContractSignedAt: Date | null;
    initialSteps: ReviewStepItem[];
    teammates: TeammateOption[];
    currentUserId: string;
    delegatedAssigneeIds: string[];
    currentUserCanManageWorkspace: boolean;
    getReviewStateAction: (dealId: string) => Promise<{
      contractStatus: string;
      dealStatus: string;
      contractCreatedAt: Date;
      contractSentAt: Date | null;
      contractSignedAt: Date | null;
      steps: ReviewStepItem[];
    } | null>;
    decideAction: (dealId: string, reviewStepId: string, decision: "approve" | "reject", formData: FormData) => Promise<{ error?: string }>;
    addChecklistItemAction: (dealId: string, reviewStepId: string, formData: FormData) => Promise<{ error?: string }>;
    toggleChecklistItemAction: (dealId: string, itemId: string, done: boolean) => Promise<{ error?: string }>;
    removeChecklistItemAction: (dealId: string, itemId: string) => Promise<{ error?: string }>;
    addCommentAction: (dealId: string, reviewStepId: string, body: string) => Promise<{ error?: string }>;
    deleteCommentAction: (dealId: string, commentId: string) => Promise<{ error?: string }>;
    updateStepMetaAction: (dealId: string, reviewStepId: string, formData: FormData) => Promise<{ error?: string }>;
  } | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [summary, setSummary] = useState(initialSummary);
  const [fields, setFields] = useState(initialFields);
  const [calls, setCalls] = useState(initialCalls);
  const [actionItems, setActionItems] = useState(initialActionItems);
  const [callHighlights, setCallHighlights] = useState(initialCallHighlights);
  const [contractIsDraft, setContractIsDraft] = useState(initialContractIsDraft);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ReviewPanel polls its own review state independently (contractStatus/
  // dealStatus), but the call-progress poll above only runs while a call is
  // actually live — once it's over (the normal case for reviewing/sending a
  // contract), it never fires again, so this page's own `status` (the top
  // badge, the generate/send-to-docusign gating) would otherwise stay frozen
  // at whatever it was on page load even as the review moves through its
  // whole lifecycle. ReviewPanel calls this on every one of its own polls so
  // this page's status tracks the review's without needing a second timer.
  function handleReviewSync(contractStatus: string, dealStatus: string) {
    setStatus(dealStatus);
    setContractIsDraft(contractStatus === "draft");
  }

  function isLive(s: string, callList: CallItem[]): boolean {
    if (s === "processing") return true;
    const last = callList[callList.length - 1];
    return Boolean(last && !last.endedAt);
  }

  useEffect(() => {
    async function poll() {
      const data = await getLiveDealStateAction(dealId);
      if (!data) return;
      setStatus(data.status);
      setSummary(data.summary);
      setFields(data.fields);
      setCalls(data.calls);
      setActionItems(data.actionItems);
      setCallHighlights(data.callHighlights);
      if (!isLive(data.status, data.calls) && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    if (isLive(initialStatus, initialCalls)) {
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const groups = new Map<string, FieldItem[]>();
  for (const field of fields) {
    if (!groups.has(field.groupLabel)) groups.set(field.groupLabel, []);
    groups.get(field.groupLabel)!.push(field);
  }
  const missing = fields.filter((f) => f.status === "missing");
  const canSendToDocusignNow = docusignEnabled && status === "ready" && contractIsDraft && clientHasEmail;

  return (
    <>
      <Link href="/deals" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Deals
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-medium" style={{ letterSpacing: "-0.6px" }}>{clientName}</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            {service}
            {callLength ? ` · from a ${callLength}` : ""}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <span className={`chip ${STATUS_CHIP[status] ?? "chip-neutral"}`}>
            <span className="chip-dot" />
            {STATUS_LABEL[status] ?? status}
          </span>
          {contractViewedAt && (
            <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
              👁 Viewed {timeAgo(contractViewedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-[18px]">
          {summary && (
            <div className="card p-5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <h2 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  Call summary
                </h2>
                {callHighlights.length > 0 && <CallHighlightsOverlay items={callHighlights} />}
              </div>
              <p className="text-[13.5px] leading-relaxed">{summary}</p>
            </div>
          )}
          <DealTermsCard
            groups={[...groups.entries()].filter(([label]) => label !== "Missing")}
            updateAction={updateFieldsAction}
          />

          {calls.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                Negotiation timeline
              </h2>
              <div className="flex flex-col gap-3">
                {calls.map((call, i) => (
                  <div key={call.id} className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: "var(--hairline-soft)" }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">Call {i + 1} - {CALL_SOURCE_LABEL[call.source] ?? call.source}</span>
                      <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                        {call.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {!call.endedAt && call.id === calls[calls.length - 1].id ? " · in progress" : ""}
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                      {callPreview(call.transcript)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ActionItemsCard dealId={dealId} items={actionItems} toggleAction={toggleActionItemAction} />

          <DealNotes
            dealId={dealId}
            notes={notes}
            currentUserEmail={currentUserEmail}
            addAction={addNoteAction}
            deleteAction={deleteNoteAction}
          />
        </div>

        <div className="flex flex-col gap-4">
          {status !== "signed" && <ContinueCallButton dealId={dealId} />}

          {status !== "signed" && status !== "sent" && fields.some((f) => f.status !== "missing") && (
            <VoiceCorrectionButton dealId={dealId} applyAction={applyVoiceFieldCorrectionAction} reviewAction={sendForReviewToAction} />
          )}

          {reviewPanel && (
            <ReviewPanel
              dealId={dealId}
              clientName={clientName}
              initialContractStatus={reviewPanel.initialContractStatus}
              initialDealStatus={status}
              initialContractCreatedAt={reviewPanel.initialContractCreatedAt}
              initialContractSentAt={reviewPanel.initialContractSentAt}
              initialContractSignedAt={reviewPanel.initialContractSignedAt}
              initialSteps={reviewPanel.initialSteps}
              teammates={reviewPanel.teammates}
              currentUserId={reviewPanel.currentUserId}
              currentUserEmail={currentUserEmail}
              delegatedAssigneeIds={reviewPanel.delegatedAssigneeIds}
              currentUserCanManageWorkspace={reviewPanel.currentUserCanManageWorkspace}
              getReviewStateAction={reviewPanel.getReviewStateAction}
              sendToAction={sendForReviewToAction}
              decideAction={reviewPanel.decideAction}
              addChecklistItemAction={reviewPanel.addChecklistItemAction}
              toggleChecklistItemAction={reviewPanel.toggleChecklistItemAction}
              removeChecklistItemAction={reviewPanel.removeChecklistItemAction}
              addCommentAction={reviewPanel.addCommentAction}
              deleteCommentAction={reviewPanel.deleteCommentAction}
              updateStepMetaAction={reviewPanel.updateStepMetaAction}
              onSync={handleReviewSync}
            />
          )}

          {status === "processing" ? (
            <div className="card flex items-center gap-2.5 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              <span className="chip-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-muted)" }} />
              Analyzing the call. Terms appear here live as they&apos;re mentioned.
            </div>
          ) : status === "extraction_failed" ? (
            <div className="card" style={{ borderColor: "rgba(245,185,77,.28)" }}>
              <div className="rounded-t-[20px] border-b px-5 py-4" style={{ background: "var(--warn-soft)", borderColor: "rgba(245,185,77,.2)" }}>
                <h2 className="text-[15px] font-medium" style={{ color: "var(--warn)" }}>Couldn&apos;t process this call</h2>
              </div>
              <div className="px-5 py-4">
                <p className="mb-3 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                  Something went wrong while extracting deal terms. Check your AI extraction setup (e.g. Anthropic billing) and try again.
                </p>
                <form action={retryExtractionAction}>
                  <button type="submit" className="btn btn-primary w-full justify-center">
                    Try again
                  </button>
                </form>
              </div>
            </div>
          ) : missing.length > 0 ? (
            <div className="card" style={{ borderColor: "rgba(245,185,77,.28)" }}>
              <div className="rounded-t-[20px] border-b px-5 py-4" style={{ background: "var(--warn-soft)", borderColor: "rgba(245,185,77,.2)" }}>
                <h2 className="text-[15px] font-medium" style={{ color: "var(--warn)" }}>Missing information</h2>
              </div>
              <form action={fillMissingFieldsAction} className="px-5 py-3">
                {missing.map((m) => (
                  <div key={m.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                    <label className="text-[13px] font-medium" htmlFor={m.id}>{m.label}</label>
                    <div className="mb-2 mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>Not mentioned in the call. Add it below.</div>
                    <input id={m.id} name={m.id} required placeholder={`Add ${m.label.toLowerCase()}…`} className="input w-full" style={{ fontSize: "13px", padding: "8px 11px" }} />
                  </div>
                ))}
                <button type="submit" className="btn btn-primary mt-3 w-full justify-center">
                  Save &amp; continue
                </button>
              </form>
            </div>
          ) : (
            <div className="card flex items-center gap-2 px-5 py-4 text-[13.5px] font-medium" style={{ color: "var(--success)" }}>
              ✓ All required information captured
            </div>
          )}

          <div className="card flex flex-col gap-2.5 p-5">
            {hasContract ? (
              <Link href={`/deals/${dealId}/contract`} className="btn btn-primary w-full justify-center">
                View contract
              </Link>
            ) : (
              <form action={generateContractAction}>
                <button type="submit" disabled={missing.length > 0 || status === "processing" || status === "extraction_failed"} className="btn btn-primary w-full justify-center">
                  Generate contract
                </button>
              </form>
            )}
            <span className="text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Uses the {templateName ?? "default"} template
            </span>
          </div>

          {canSendToDocusignNow && <SendToDocusignButton dealId={dealId} sendAction={sendViaDocusignNowAction} />}
        </div>
      </div>
    </>
  );
}
