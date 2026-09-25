"use client";

import { useEffect, useRef } from "react";

// Polls every `intervalMs` only while the page is visible. The desktop app
// keeps SealMe open all day, so hidden tabs/windows polling nonstop was pure
// database load. Coming back to the page refreshes immediately instead of
// waiting out the interval.
export function useVisibleInterval(tick: () => void, intervalMs: number, enabled = true) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) id = setInterval(() => tickRef.current(), intervalMs);
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        tickRef.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
