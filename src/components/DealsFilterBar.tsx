"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "processing", label: "Analyzing" },
  { value: "missing_info", label: "Missing info" },
  { value: "extraction_failed", label: "Couldn't process" },
  { value: "ready", label: "Ready" },
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
];

// Every control here writes straight to the URL (searchParams) rather than
// local state — the page itself re-fetches from Prisma with the resulting
// filters, so a filtered/sorted view is a shareable, bookmarkable link and
// survives a refresh, the same way ?view=board already does.
export default function DealsFilterBar({
  owners,
  showOwnerFilter,
}: {
  owners: { id: string; name: string }[];
  showOwnerFilter: boolean;
}) {
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
    debounceRef.current = setTimeout(() => updateParam("q", q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Boolean(searchParams.get("q") || searchParams.get("status") || searchParams.get("owner"));

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search client or service…"
        className="input"
        style={{ fontSize: "13px", padding: "7px 11px", width: 220 }}
      />
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value)}
        className="input"
        style={{ fontSize: "13px", padding: "7px 11px", width: 160 }}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {showOwnerFilter && (
        <select
          value={searchParams.get("owner") ?? ""}
          onChange={(e) => updateParam("owner", e.target.value)}
          className="input"
          style={{ fontSize: "13px", padding: "7px 11px", width: 160 }}
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
            router.push(pathname);
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
