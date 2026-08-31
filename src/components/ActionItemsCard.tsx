"use client";

import { useState, useTransition } from "react";

type ActionItem = {
  id: string;
  description: string;
  ownerType: string; // team | client
  dueDate: Date | null;
  status: string; // open | done
  sourceQuote: string | null;
};

function formatDue(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(date: Date): boolean {
  return date.getTime() < Date.now();
}

export default function ActionItemsCard({
  dealId,
  items,
  toggleAction,
}: {
  dealId: string;
  items: ActionItem[];
  toggleAction: (dealId: string, itemId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(itemId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await toggleAction(dealId, itemId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const open = items.filter((i) => i.status !== "done");
  const doneItems = items.filter((i) => i.status === "done");
  const ordered = [...open, ...doneItems];

  if (items.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Action items</h2>
        {open.length > 0 && (
          <span className="chip chip-neutral" style={{ fontSize: 11 }}>{open.length} open</span>
        )}
      </div>
      {error && (
        <div className="mx-5 mt-3 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}
      <div className="px-5 py-1.5">
        {ordered.map((item) => {
          const done = item.status === "done";
          const overdue = !done && item.dueDate && isOverdue(item.dueDate);
          return (
            <div key={item.id} className="border-b py-3 last:border-b-0" style={{ borderColor: "var(--hairline-soft)" }}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => toggle(item.id)}
                  className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] text-[11px]"
                  style={{
                    border: `1.5px solid ${done ? "var(--accent-blue)" : "var(--hairline)"}`,
                    background: done ? "var(--accent-blue)" : "transparent",
                    color: "#fff",
                  }}
                  title={done ? "Mark as open" : "Mark as done"}
                >
                  {done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[13.5px]"
                      style={{ color: done ? "var(--ink-muted)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}
                    >
                      {item.description}
                    </span>
                    <span className="chip chip-neutral flex-none" style={{ fontSize: 10.5 }}>
                      {item.ownerType === "client" ? "Client" : "Team"}
                    </span>
                    {item.sourceQuote && (
                      <button
                        onClick={() => setOpenQuote(openQuote === item.id ? null : item.id)}
                        title="Show source"
                        className="flex h-[16px] w-[16px] flex-none items-center justify-center rounded-[5px] text-[10.5px]"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        ⓘ
                      </button>
                    )}
                  </div>
                  {item.dueDate && (
                    <div className="mt-0.5 text-[11.5px]" style={{ color: overdue ? "#c0392b" : "var(--ink-muted)" }}>
                      {overdue ? "Overdue — was due" : "Due"} {formatDue(item.dueDate)}
                    </div>
                  )}
                  {item.sourceQuote && openQuote === item.id && (
                    <blockquote
                      className="mt-2 rounded-r-[8px] py-2 pl-3 pr-3 text-[12px] italic"
                      style={{ borderLeft: "2px solid var(--accent-blue)", background: "var(--surface-2)", color: "var(--ink-muted)" }}
                    >
                      {item.sourceQuote}
                    </blockquote>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
