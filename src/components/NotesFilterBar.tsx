"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Search and campaign for the Notes list, kept in the URL like the other
// lists so a filtered view is a link.
export default function NotesFilterBar({ campaigns }: { campaigns: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("added");
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or company…"
        aria-label="Search clients with notes"
        className="input w-full sm:w-[240px]"
        style={{ fontSize: "13px", padding: "7px 11px" }}
      />
      {campaigns.length > 0 && (
        <select
          value={params.get("campaign") ?? ""}
          onChange={(e) => update("campaign", e.target.value)}
          className="input w-full sm:w-[200px]"
          style={{ fontSize: "13px", padding: "7px 11px" }}
          aria-label="Campaign"
        >
          <option value="">Any campaign</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
    </div>
  );
}
