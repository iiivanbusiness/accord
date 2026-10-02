"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveTimeZone } from "@/app/(app)/preferences-actions";

// Keeps the browser's timezone known to the server: in a cookie, so pages
// like Today render the viewer's day (when it was missing or out of date
// the page re-renders once), and on the account, so the morning task
// email goes out for the right day.
export default function TimezoneSync({ stored }: { stored: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    if (tz !== stored) saveTimeZone(tz).catch(() => {});
    const current = document.cookie.split("; ").find((c) => c.startsWith("tz="))?.slice(3);
    if (current && decodeURIComponent(current) === tz) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax${secure}`;
    router.refresh();
  }, [router, stored]);
  return null;
}
