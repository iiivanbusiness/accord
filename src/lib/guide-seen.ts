"use client";

import { useSyncExternalStore } from "react";
import { GUIDE_SEEN_KEY } from "@/lib/get-started";

// The setup guide's "look at this" steps, ticked off in this browser once
// they've been opened from the guide. Storage can be missing or blocked;
// then nothing is ticked and the guide still works.
const EVENT = "sealme-guide-seen";

function read(): string {
  try {
    return window.localStorage.getItem(GUIDE_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parse(raw: string): string[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useGuideSeen(): string[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return parse(raw);
}

export function markGuideSeen(id: string): void {
  try {
    const list = parse(read());
    if (list.includes(id)) return;
    window.localStorage.setItem(GUIDE_SEEN_KEY, JSON.stringify([...list, id]));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}
