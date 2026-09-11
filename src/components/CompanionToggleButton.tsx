"use client";

import { useEffect, useState } from "react";

// Manual toggle for the floating companion panel (see desktop-app's
// toggle_companion_window command) — collapses the main window and shows
// the small always-on-top panel instead, or the reverse if it's already
// showing. Only rendered inside the desktop app; same isTauri detection
// pattern as ContinueCallButton/LocalCaptureForm.
export default function CompanionToggleButton() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);

  if (!isTauri) return null;

  async function handleClick() {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("toggle_companion_window").catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Open floating panel"
      aria-label="Open floating panel"
      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
      style={{ color: "var(--ink-muted)" }}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" width={17} height={17}>
        <rect x="3" y="3.5" width="14" height="13" rx="2" />
        <rect x="10.5" y="9.5" width="5.2" height="5.6" rx="1.2" fill="currentColor" stroke="none" opacity={0.9} />
      </svg>
    </button>
  );
}
