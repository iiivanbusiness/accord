"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { viewerTimeZone } from "@/components/TaskFields";

// "Hand out work": give one rep the next N leads nobody is working on, as
// cold calls for today or tomorrow. SealMe picks the leads.
export default function QuickAssign({
  members,
  freeLeads,
  assignAction,
  embedded = false,
}: {
  members: { id: string; name: string }[];
  freeLeads: number;
  // Inside a Dashboard line, which already says how many leads are free.
  embedded?: boolean;
  assignAction: (input: { assigneeId: string; count: number; day: "today" | "tomorrow"; timezone: string }) => Promise<{ created: number }>;
}) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");
  const [count, setCount] = useState(Math.min(20, Math.max(freeLeads, 1)));
  const [day, setDay] = useState<"today" | "tomorrow">("tomorrow");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function assign() {
    setMessage(null);
    startTransition(async () => {
      try {
        const { created } = await assignAction({ assigneeId, count, day, timezone: viewerTimeZone() });
        const who = members.find((m) => m.id === assigneeId)?.name ?? "them";
        setMessage({ kind: "ok", text: `${created} ${created === 1 ? "call" : "calls"} handed to ${who} for ${day}.` });
        router.refresh();
      } catch (err) {
        setMessage({ kind: "error", text: err instanceof Error ? err.message : "Couldn't hand out the work" });
      }
    });
  }

  return (
    <section className={`${embedded ? "" : "card "}flex flex-col gap-3 px-4 py-4 sm:px-5`}>
      {!embedded && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-medium">Hand out work</h2>
          <span className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            {freeLeads.toLocaleString("en-US")} {freeLeads === 1 ? "lead" : "leads"} nobody is working on
          </span>
        </div>
      )}
      {freeLeads === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
          Every lead has someone on it. <Link href="/leads/import" className="font-medium" style={{ color: "var(--accent-blue)" }}>Import more leads</Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
          <span>Give</span>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input w-auto" aria-label="Who gets the calls">
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={Math.min(200, freeLeads)}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="input w-[84px]"
            aria-label="How many calls"
          />
          <span>cold calls for</span>
          <select value={day} onChange={(e) => setDay(e.target.value === "today" ? "today" : "tomorrow")} className="input w-auto" aria-label="Which day">
            <option value="today">today</option>
            <option value="tomorrow">tomorrow</option>
          </select>
          <button type="button" disabled={pending || !assigneeId || count < 1} onClick={assign} className="btn btn-primary btn-sm">
            {pending ? "Handing out…" : "Hand out"}
          </button>
        </div>
      )}
      {message && (
        <div className={`chip ${message.kind === "ok" ? "chip-success" : "chip-warn"} w-fit max-w-full whitespace-normal break-words px-3 py-1.5 text-[12.5px]`}>{message.text}</div>
      )}
      <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
        SealMe picks the oldest free leads. To choose leads yourself, select them in <Link href="/leads" className="underline">Leads</Link> and tap Assign.
      </div>
    </section>
  );
}
