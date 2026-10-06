"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CallPlan } from "@/app/(app)/leads/phone-actions";
import { US_STATE_NAME } from "@/lib/us-states";

type Template = { id: string; name: string };

const stateName = (state: string | null) => (state ? (US_STATE_NAME[state] ?? state) : "This state");

const DIRECT_REASON: Record<string, (state: string | null) => string> = {
  all_party: (state) => `${stateName(state)} needs everyone's consent to record, so SealMe stays off this call.`,
  unknown: () => "SealMe can't tell which state this number is in, so it stays off this call.",
  non_us: () => "SealMe doesn't record calls to numbers outside the US.",
  toll_free: () => "SealMe doesn't record calls to toll-free numbers.",
  no_number: () => "SealMe can't place this number, so it stays off this call.",
};

function display(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// Call a lead with SealMe on the line: the rep's phone calls the SealMe
// number, then they add the client and merge. When SealMe may not record
// this lead, the client is dialed directly and the rep is told why.
// compact is the one-button version for a Today row (cold or sales from
// the task, SealMe picks the template).
export default function LeadCallButton({
  leadName,
  templates = [],
  defaultMode = "cold",
  compact = false,
  primary = true,
  startAction,
}: {
  leadName: string;
  templates?: Template[];
  defaultMode?: "cold" | "sales";
  compact?: boolean;
  primary?: boolean;
  startAction: (input: { mode: string; templateId?: string | null }) => Promise<CallPlan>;
}) {
  const [mode, setMode] = useState(defaultMode);
  const [templateId, setTemplateId] = useState("");
  const [plan, setPlan] = useState<CallPlan | null>(null);
  const [pending, startTransition] = useTransition();

  // Getting ready is a server round trip; the dialing itself is a plain
  // tel: link the rep taps, which phones never block.
  function prepare() {
    setPlan(null);
    startTransition(async () => {
      try {
        setPlan(await startAction({ mode, templateId: mode === "sales" ? templateId || null : null }));
      } catch {
        setPlan({ kind: "error", error: "Something went wrong. Try again" });
      }
    });
  }

  const dialButton = (href: string, label: string) => (
    <a href={`tel:${href}`} className="btn btn-primary btn-sm justify-center">
      {label}
    </a>
  );

  const steps =
    plan?.kind === "sealme" ? (
      <div className="flex flex-col gap-2">
        {dialButton(plan.dial, "Call SealMe")}
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[12.5px]" style={{ color: "var(--ink)" }}>
          <li>Call SealMe ({display(plan.dial)}).</li>
          <li>
            When SealMe picks up, tap <b>Add call</b> and dial {leadName} at <span className="font-medium whitespace-nowrap">{display(plan.leadPhone)}</span>.
          </li>
          <li>Tap <b>Merge</b>.</li>
          {plan.announce && (
            <li>
              Once {leadName} is on, press <b>1</b> to play the recording notice. {stateName(plan.state)} needs everyone&apos;s consent, so nothing is recorded before it.
            </li>
          )}
        </ol>
        <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Call within 10 minutes and SealMe ties the call to {leadName}.</div>
      </div>
    ) : plan?.kind === "direct" ? (
      <div className="flex flex-col gap-2">
        {dialButton(plan.dial, `Call ${display(plan.dial)}`)}
        {plan.reason !== "no_sealme_number" && <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{DIRECT_REASON[plan.reason]?.(plan.state)} Call {leadName} directly.</div>}
      </div>
    ) : plan?.kind === "error" ? (
      <div className="chip chip-warn w-fit max-w-full whitespace-normal break-words px-3 py-1.5 text-left text-[12.5px]">
        {plan.error}.{plan.error.includes("Settings") && <> <Link href="/settings" className="font-medium underline">Open Settings</Link></>}
      </div>
    ) : null;

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {plan && plan.kind !== "error" ? (
          <div className="w-full max-w-[320px]">{steps}</div>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={prepare} className={`btn btn-sm ${primary ? "btn-primary" : "btn-secondary"}`}>
              {pending ? "Getting ready…" : "Call"}
            </button>
            {steps && <div className="max-w-[320px]">{steps}</div>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="text-[14px] font-medium">Call</div>
      <div className="flex flex-col gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value === "sales" ? "sales" : "cold")} className="input" aria-label="Kind of call">
          <option value="cold">Cold call</option>
          <option value="sales">Sales call</option>
        </select>
        {mode === "sales" && (
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input" aria-label="Contract template">
            <option value="">Let SealMe pick the template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {!(plan && plan.kind !== "error") && (
          <button type="button" disabled={pending} onClick={prepare} className="btn btn-primary btn-sm justify-center">
            {pending ? "Getting ready…" : `Call ${leadName}`}
          </button>
        )}
      </div>
      {steps}
      {plan && plan.kind !== "error" && (
        <button type="button" onClick={() => setPlan(null)} className="w-fit text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Start over
        </button>
      )}
    </div>
  );
}
