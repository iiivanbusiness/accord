"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page every few seconds while something on it is still
// being worked on in the background, so the result appears on its own.
export default function RefreshWhileBusy({ busy, everyMs = 3000 }: { busy: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [busy, everyMs, router]);
  return null;
}
