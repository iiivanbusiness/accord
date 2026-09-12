"use client";

import { useState } from "react";
import { acknowledgeAiDisclosure } from "@/app/(app)/settings/account-actions";

// Apple Guideline 5.1.2(i) (in force since 13 Nov 2025) and the EU AI Act
// Article 50 both require a notice naming the provider before personal data
// reaches a third-party AI, shown at or before first interaction — not
// buried in the privacy policy. SealMe sends call audio/transcripts to
// Anthropic (Claude) to extract deal terms and notes, so this shows once,
// gated by User.aiDisclosureAcknowledgedAt, the first time someone lands in
// the app after signing up.
export default function AiDisclosureModal({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  async function handleAcknowledge() {
    setBusy(true);
    try {
      await acknowledgeAiDisclosure();
    } finally {
      setVisible(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="card w-full max-w-[440px] p-6">
        <h2 className="text-[16px] font-medium">Call data and AI</h2>
        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          When you record or connect a sales call, SealMe sends the audio and transcript to{" "}
          <strong style={{ color: "var(--ink)" }}>Anthropic</strong> (Claude) to extract deal terms, contract
          details, and call notes. This happens for every call SealMe processes — turning it off isn&apos;t
          possible without turning off that feature entirely.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Read the full details in our{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2" style={{ color: "var(--ink)" }}>
            privacy policy
          </a>
          .
        </p>
        <button type="button" disabled={busy} onClick={handleAcknowledge} className="btn btn-primary btn-sm mt-5 w-full justify-center">
          {busy ? "…" : "I understand"}
        </button>
      </div>
    </div>
  );
}
