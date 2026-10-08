"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the page every few seconds while it's rendered: for a list
// that's waiting on work in the background (a call being written up).
// Rendered only while there's something to wait for.
export default function RefreshWhile({ everyMs = 4000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
