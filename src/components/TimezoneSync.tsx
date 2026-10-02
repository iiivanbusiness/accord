"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps the tz cookie in step with the browser's timezone. The server reads
// it to work out "today" for the viewer; when it was missing or out of date
// the page re-renders once with the right day.
export default function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith("tz="))?.slice(3);
    if (current && decodeURIComponent(current) === tz) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax${secure}`;
    router.refresh();
  }, [router]);
  return null;
}
