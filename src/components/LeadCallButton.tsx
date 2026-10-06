"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CallPlan } from "@/app/(app)/leads/phone-actions";
import { US_STATE_NAME } from "@/lib/us-states";

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

const PHONE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z" />
  </svg>
);

// Call a lead with SealMe on the line: one tap gets it ready, then a tel:
// link the rep taps (phones never block those) calls the SealMe number,
// and they add the client and merge. Nobody picks cold or sales: SealMe
// tells from the call. When SealMe may not record this lead, the client is
// dialed directly and the rep is told why.
//   card     the Call box on a lead
//   compact  one button, for a Today row
//   hero     the big white button on Today's dark Next up card
export default function LeadCallButton({
  leadName,
  variant = "card",
  primary = true,
  startAction,
}: {
  leadName: string;
  variant?: "card" | "compact" | "hero";
  primary?: boolean;
  startAction: (input: { mode?: string }) => Promise<CallPlan>;
}) {
  const [plan, setPlan] = useState<CallPlan | null>(null);
  const [pending, startTransition] = useTransition();
  const firstName = leadName.split(/\s+/)[0] || leadName;
  const hero = variant === "hero";

  function prepare() {
    setPlan(null);
    startTransition(async () => {
      try {
        setPlan(await startAction({}));
      } catch {
        setPlan({ kind: "error", error: "Something went wrong. Try again" });
      }
    });
  }

  // The Next up card is the inverted surface (dark in light mode, light in
  // dark mode), so the hero button flips with it.
  const muted = hero ? "var(--on-surface-inverted-muted)" : "var(--ink-muted)";
  const big = hero || variant === "card";
  const dialStyle = hero ? { background: "var(--on-surface-inverted)", color: "var(--surface-inverted)" } : undefined;
  const dialButton = (href: string, label: string) => (
    <a href={`tel:${href}`} className={`btn btn-primary ${big ? "" : "btn-sm"} w-full justify-center gap-2`} style={{ ...dialStyle, ...(big ? { height: 50, fontSize: 16 } : null) }}>
      {PHONE_ICON}
      {label}
    </a>
  );

  const steps =
    plan?.kind === "sealme" ? (
      <div className="flex flex-col gap-2">
        {dialButton(plan.dial, "Call SealMe")}
        <div className="text-[12.5px] leading-relaxed" style={{ color: muted }}>
          When SealMe picks up, tap <b>Add call</b>, dial {firstName} at <span className="whitespace-nowrap font-medium">{display(plan.leadPhone)}</span>, then <b>Merge</b>.
          {plan.announce && <> Once {firstName} is on, press <b>1</b> for the recording notice: {stateName(plan.state)} needs everyone&apos;s consent.</>}
          {" "}SealMe writes up the call when you hang up.
        </div>
      </div>
    ) : plan?.kind === "direct" ? (
      <div className="flex flex-col gap-2">
        {dialButton(plan.dial, `Call ${display(plan.dial)}`)}
        {plan.reason !== "no_sealme_number" && <div className="text-[12.5px]" style={{ color: muted }}>{DIRECT_REASON[plan.reason]?.(plan.state)} Call {firstName} directly.</div>}
      </div>
    ) : plan?.kind === "error" ? (
      <div className="chip chip-warn w-fit max-w-full whitespace-normal break-words px-3 py-1.5 text-left text-[12.5px]">
        {plan.error}.{plan.error.includes("Settings") && <> <Link href="/settings" className="font-medium underline">Open Settings</Link></>}
      </div>
    ) : null;

  const ready = plan && plan.kind !== "error";
  const callButton = (
    <button
      type="button"
      disabled={pending}
      onClick={prepare}
      className={`btn ${hero || primary ? "btn-primary" : "btn-secondary"} ${big ? "w-full" : "btn-sm"} justify-center gap-2`}
      style={{ ...dialStyle, ...(big ? { height: 50, fontSize: 16 } : null) }}
    >
      {big && PHONE_ICON}
      {pending ? "Getting ready…" : big ? `Call ${firstName}` : "Call"}
    </button>
  );

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {ready ? <div className="w-full max-w-[320px]">{steps}</div> : callButton}
        {!ready && steps && <div className="max-w-[320px]">{steps}</div>}
      </div>
    );
  }

  return (
    <div className={hero ? "flex flex-col gap-2.5" : "card flex flex-col gap-3 p-4"}>
      {!hero && <div className="text-[14px] font-medium">Call</div>}
      {ready ? steps : callButton}
      {!ready && steps}
      {ready && (
        <button type="button" onClick={() => setPlan(null)} className="w-fit text-[12px] font-medium" style={{ color: muted }}>
          Start over
        </button>
      )}
    </div>
  );
}
