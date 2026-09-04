"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Proposal =
  | { intent: "update_field"; fieldKey: string; fieldLabel: string; currentValue: string | null; proposedValue: string; confirmationText: string }
  | { intent: "send_for_review"; recipientUserId: string; recipientName: string; confirmationText: string }
  | { intent: "unclear"; confirmationText: string };

type ApiResponse = { transcript?: string; proposal?: Proposal; audioBase64?: string | null; error?: string };

type Status = "idle" | "recording" | "processing" | "confirming" | "applying";

// Push-to-talk voice control: hold the button, say what should change (or
// who to send this to for review), release. Nothing is written or sent
// until the rep hears the proposal read back and explicitly taps "Yes" —
// see /api/deals/[id]/voice-correction (propose, never writes/sends) and
// applyAction/reviewAction below (apply, only called from that tap) — so a
// misheard word surfaces as an odd-sounding confirmation instead of a
// silently wrong contract or an email to the wrong person.
export default function VoiceCorrectionButton({
  dealId,
  applyAction,
  reviewAction,
}: {
  dealId: string;
  applyAction: (dealId: string, fieldKey: string, newValue: string) => Promise<void>;
  reviewAction: (dealId: string, recipientUserId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    setProposal(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void handleClipReady(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Couldn't access the microphone — check your browser/system permission");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setStatus("processing");
    }
  }

  async function handleClipReady(blob: Blob) {
    try {
      const res = await fetch(`/api/deals/${dealId}/voice-correction`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      const data = (await res.json()) as ApiResponse;

      if (data.error) {
        setError(data.error);
        setStatus("idle");
        return;
      }
      if (data.audioBase64) {
        new Audio(`data:audio/mpeg;base64,${data.audioBase64}`).play().catch(() => {});
      }
      if (data.proposal) {
        setProposal(data.proposal);
        setStatus("confirming");
      } else {
        setStatus("idle");
      }
    } catch {
      setError("Couldn't reach the server — try again");
      setStatus("idle");
    }
  }

  function handleConfirm() {
    if (!proposal) return;
    setStatus("applying");
    startTransition(async () => {
      try {
        if (proposal.intent === "update_field") {
          await applyAction(dealId, proposal.fieldKey, proposal.proposedValue);
        } else if (proposal.intent === "send_for_review") {
          await reviewAction(dealId, proposal.recipientUserId);
        }
        router.refresh();
      } catch {
        setError(
          proposal.intent === "send_for_review"
            ? "Couldn't send that email — check your Resend setup and try again"
            : "Couldn't save that change — try editing the field directly"
        );
      } finally {
        setProposal(null);
        setStatus("idle");
      }
    });
  }

  function handleCancel() {
    setProposal(null);
    setStatus("idle");
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {status === "confirming" && proposal ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] leading-relaxed">{proposal.confirmationText}</p>
          {(proposal.intent === "update_field" || proposal.intent === "send_for_review") && (
            <div className="flex gap-2">
              <button type="button" disabled={isPending} onClick={handleConfirm} className="btn btn-primary btn-sm flex-1 justify-center">
                {isPending ? "Working…" : proposal.intent === "send_for_review" ? "Yes, send" : "Yes, apply"}
              </button>
              <button type="button" disabled={isPending} onClick={handleCancel} className="btn btn-secondary btn-sm flex-1 justify-center">
                Cancel
              </button>
            </div>
          )}
          {proposal.intent === "unclear" && (
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-sm w-full justify-center">
              Dismiss
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={status === "processing" || status === "applying"}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => status === "recording" && stopRecording()}
            onTouchStart={(e) => {
              e.preventDefault();
              startRecording();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopRecording();
            }}
            className="btn w-full justify-center"
            style={
              status === "recording"
                ? { background: "var(--warn)", color: "#fff" }
                : { background: "var(--surface-1)", color: "var(--ink)", border: "1px solid var(--hairline)" }
            }
          >
            {status === "recording" ? "🎙 Listening — release to send" : status === "processing" ? "Thinking…" : "🎙 Hold to talk"}
          </button>
          <span className="text-center text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Hold, say what should change (or who to send this to for review), let go.
          </span>
        </>
      )}
    </div>
  );
}
