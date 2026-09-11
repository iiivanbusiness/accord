"use client";

import { useEffect, useState } from "react";
import GlassPanel from "./GlassPanel";
import CallHighlightsList, { type CallHighlightItem } from "./CallHighlightsList";

// The expanded view behind "Call summary"'s detail button — same overlay
// mechanics as MobileNavDrawer (fixed inset-0 + backdrop + GlassPanel), the
// only existing overlay pattern in this codebase, but centered as a dialog
// rather than a slide-in panel since this is a content viewer, not
// navigation.
export default function CallHighlightsOverlay({ items }: { items: CallHighlightItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] font-medium"
        style={{ color: "var(--accent-blue)" }}
      >
        View details →
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[560px]">
            <GlassPanel className="max-h-[80vh] w-full rounded-[20px] px-5 py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-medium">Call details</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" width={16} height={16}>
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
              <CallHighlightsList items={items} />
            </GlassPanel>
          </div>
        </div>
      )}
    </>
  );
}
