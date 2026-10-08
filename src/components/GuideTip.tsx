"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { markGuideSeen } from "@/lib/guide-seen";

// inline: shown next to the thing it's about (by a GuideTip with `at`),
// not at the top of the page.
type Tip = { title: string; body: string; seen?: string; inline?: boolean };

// What each place in the app is for, shown when it's opened from the setup
// guide (?guide=…). Opening a "look at this" step ticks it off in the guide.
function tipFor(guide: string, pathname: string): Tip | null {
  const onLead = /^\/leads\/(?!new$|import$)[^/]+$/.test(pathname);
  switch (guide) {
    case "calls":
      return pathname === "/calls"
        ? {
            title: "Calls: where every call starts",
            body: "Drop a recording or video of a call here, or choose a file. Keep Notes only and press Process. SealMe writes the notes and puts them on the client's lead, the same lead every time you talk to that client.",
          }
        : null;
    case "lead":
      if (onLead) {
        return {
          title: "The client's file",
          body: "Every call with this client lands here, each with its notes. From the second call on, Where things stand sums them all up at the top. Copy all notes gives you the whole file for an email or a report. A call on the wrong client? Use Move to another lead.",
          seen: "lead",
        };
      }
      return pathname === "/leads"
        ? { title: "Open a lead to see the client's file", body: "Each lead is one client, with every call you've had with them. Add a call first and its client shows up here." }
        : null;
    case "todo":
      return pathname === "/dashboard"
        ? {
            title: "Your to-do list",
            body: "Next steps agreed on a call show up here on their day, in the order your day happens. Tick them off as you go. A manager can switch to the team's list.",
            seen: "todo",
            inline: true,
          }
        : null;
    case "leads":
      return pathname === "/leads"
        ? {
            title: "Leads: all your clients",
            body: "Search by name or company, pick Last call first to see who you talked to most recently, and filter by campaign when you call for several clients. The Calls column shows how many calls each client has had.",
            seen: "leads",
          }
        : null;
    case "contracts":
      return pathname === "/deals/new"
        ? {
            title: "Notes and a contract",
            body: "Pick Notes and contract, add the recording or transcript, and choose a template. SealMe drafts the contract from what was agreed, for you to check before it goes out.",
          }
        : null;
    default:
      return null;
  }
}

// At the top of every page (no `at`), or placed next to what it's about
// (`at` = the guide step, e.g. the to-do list on the Dashboard).
export default function GuideTip({ at }: { at?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const guide = params.get("guide") ?? "";
  const found = guide ? tipFor(guide, pathname) : null;
  const tip = found && (at ? found.inline && at === guide : !found.inline) ? found : null;

  useEffect(() => {
    if (tip?.seen) markGuideSeen(tip.seen);
  }, [tip?.seen]);

  if (!tip) return null;

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("guide");
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  return (
    <div className="glass-card glass-card-solid mb-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5" role="note" aria-label="Setup guide tip">
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold uppercase" style={{ letterSpacing: "0.5px", color: "var(--ink-muted)" }}>Setup guide</div>
        <div className="mt-0.5 text-[14.5px] font-medium">{tip.title}</div>
        <div className="mt-1 max-w-[68ch] text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{tip.body}</div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <Link href="/dashboard#setup" className="btn btn-secondary btn-sm whitespace-nowrap">
          Back to the guide
        </Link>
        <button type="button" onClick={close} className="btn btn-ghost btn-sm" aria-label="Close the tip">
          Close
        </button>
      </div>
    </div>
  );
}
