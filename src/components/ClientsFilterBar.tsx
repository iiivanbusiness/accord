"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Same URL-as-state pattern as DealsFilterBar — a filtered view is a
// shareable, bookmarkable link and survives a refresh.
export default function ClientsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, company, or email…"
        className="input"
        style={{ fontSize: "13px", padding: "7px 11px", width: 260 }}
      />
      {searchParams.get("q") && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.push(pathname);
          }}
          className="text-[12.5px] font-medium"
          style={{ color: "var(--ink-muted)" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
