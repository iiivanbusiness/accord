"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LEAD_STAGES, LEAD_STAGE_LABEL } from "@/lib/lead-stages";

// Same URL-driven pattern as DealsFilterBar: every control writes to the
// query string and the page re-queries, so a filtered list is a link.
export default function LeadsFilterBar({ owners, showOwnerFilter }: { owners: { id: string; name: string }[]; showOwnerFilter: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== q) updateParam("q", q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Boolean(searchParams.get("q") || searchParams.get("stage") || searchParams.get("owner"));

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, company, email…"
        className="input w-full sm:w-[240px]"
        style={{ fontSize: "13px", padding: "7px 11px" }}
      />
      <select
        value={searchParams.get("stage") ?? ""}
        onChange={(e) => updateParam("stage", e.target.value)}
        className="input flex-1 sm:w-[160px] sm:flex-none"
        style={{ fontSize: "13px", padding: "7px 11px" }}
        aria-label="Stage"
      >
        <option value="">Any stage</option>
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>{LEAD_STAGE_LABEL[s]}</option>
        ))}
      </select>
      {showOwnerFilter && (
        <select
          value={searchParams.get("owner") ?? ""}
          onChange={(e) => updateParam("owner", e.target.value)}
          className="input flex-1 sm:w-[160px] sm:flex-none"
          style={{ fontSize: "13px", padding: "7px 11px" }}
          aria-label="Owner"
        >
          <option value="">Any owner</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            const params = new URLSearchParams();
            const tab = searchParams.get("tab");
            if (tab) params.set("tab", tab);
            router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
          }}
          className="text-[12.5px] font-medium"
          style={{ color: "var(--ink-muted)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
