"use client";

import { useState } from "react";

export type RecentNoteItem = {
  id: string;
  type: string; // discussion_point | objection | competitor_mention | next_step
  body: string;
  sourceQuote: string | null;
  dealId: string;
  clientName: string;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  discussion_point: "Discussion",
  objection: "Objection",
  competitor_mention: "Competitor",
  next_step: "Next step",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Sibling to CallHighlightsList, not a variant of it: that one groups by
// TYPE (right for "everything from one call"), this one groups by
// CLIENT/DEAL (right for "everything across many calls") — forcing one
// component to do both groupings made the branching harder to follow than
// just having two small components sharing a row shape. Used only by
// CompanionPanel's "Notes" tab.
export default function RecentNotesList({ items }: { items: RecentNoteItem[] }) {
  const [openQuote, setOpenQuote] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        No notes yet — they show up here after a call ends.
      </p>
    );
  }

  const groups: { dealId: string; clientName: string; items: RecentNoteItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.dealId === item.dealId) last.items.push(item);
    else groups.push({ dealId: item.dealId, clientName: item.clientName, items: [item] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={`${group.dealId}-${group.items[0].id}`}>
          <h3 className="mb-1.5 truncate text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            {group.clientName}
          </h3>
          <div className="flex flex-col">
            {group.items.map((item) => (
              <div key={item.id} className="border-b py-2 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ink-muted)" }}>
                      <span>{TYPE_LABEL[item.type] ?? item.type}</span>
                      <span>·</span>
                      <span>{formatWhen(item.createdAt)}</span>
                    </div>
                    <p className="text-[12.5px] leading-snug">{item.body}</p>
                  </div>
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
      ))}
    </div>
  );
}
