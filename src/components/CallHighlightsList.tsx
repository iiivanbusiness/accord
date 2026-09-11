"use client";

import { useState } from "react";

export type CallHighlightItem = {
  id: string;
  type: string; // discussion_point | objection | competitor_mention | next_step
  body: string;
  sourceQuote: string | null;
};

// Fixed display order — not alphabetical, not creation order. Discussion
// points set the scene, objections and competitor mentions are what a rep
// skims for first, next steps close it out.
const GROUP_ORDER: { type: string; label: string }[] = [
  { type: "discussion_point", label: "Discussion points" },
  { type: "objection", label: "Objections" },
  { type: "competitor_mention", label: "Competitors mentioned" },
  { type: "next_step", label: "Next steps" },
];

// Shared between CallHighlightsOverlay (deal page) and CompanionPanel (the
// floating window) so the grouping/row markup exists in exactly one place.
export default function CallHighlightsList({ items }: { items: CallHighlightItem[] }) {
  const [openQuote, setOpenQuote] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
        Nothing extracted from this call yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUP_ORDER.map(({ type, label }) => {
        const group = items.filter((item) => item.type === type);
        if (group.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              {label}
            </h3>
            <div className="flex flex-col">
              {group.map((item) => (
                <div key={item.id} className="border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13.5px] leading-snug">{item.body}</p>
                    {item.sourceQuote && (
                      <button
                        type="button"
                        onClick={() => setOpenQuote(openQuote === item.id ? null : item.id)}
                        title="Show source"
                        className="flex h-[16px] w-[16px] flex-none items-center justify-center rounded-[5px] text-[10.5px]"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        ⓘ
                      </button>
                    )}
                  </div>
                  {item.sourceQuote && openQuote === item.id && (
                    <blockquote
                      className="mt-2 rounded-r-[8px] py-2 pl-3 pr-3 text-[12px] italic"
                      style={{ borderLeft: "2px solid var(--accent-blue)", background: "var(--surface-2)", color: "var(--ink-muted)" }}
                    >
                      {item.sourceQuote}
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
