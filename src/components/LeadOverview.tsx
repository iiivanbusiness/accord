"use client";

import { CopyButton } from "@/components/LeadCalls";
import { noteLines } from "@/lib/note-lines";

// "Where things stand" across all of a lead's calls, above the calls
// themselves, so a second or fifth conversation starts from the full picture.
export default function LeadOverview({ overview, calls, since }: { overview: string; calls: number; since: string }) {
  const lines = noteLines(overview);
  const first = new Date(since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="card flex flex-col gap-2.5 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-[14px] font-medium">Where things stand</div>
        <div className="flex items-center gap-3 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          <span>
            {calls} calls since {first}
          </span>
          <CopyButton text={() => lines.map((l) => `- ${l}`).join("\n")} />
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-snug">
        {lines.map((l, i) => (
          <li key={i} className="break-words">{l}</li>
        ))}
      </ul>
    </div>
  );
}
