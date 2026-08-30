"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { continueLocalCapture } from "@/app/(app)/deals/new/actions";
import { LOCAL_CAPTURE_STORAGE_KEY, LOCAL_CAPTURE_EVENT } from "./LocalCaptureForm";

// Attaches a follow-up recording to an existing deal — same native-capture
// flow as LocalCaptureForm, just without the client-name/template fields
// since those already exist on the deal. Only rendered inside the desktop
// app; the deal page itself hides this section entirely outside Tauri.
export default function ContinueCallButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);

  async function handleClick() {
    setBusy(true);
    setError(null);

    const { invoke } = await import("@tauri-apps/api/core");

    try {
      await invoke("start_local_capture");
    } catch (err) {
      setError(typeof err === "string" ? err : "Couldn't start capture — check Screen Recording permission in System Settings");
      setBusy(false);
      return;
    }

    try {
      const result = await continueLocalCapture(dealId);
      if ("error" in result) {
        await invoke("discard_local_capture").catch(() => {});
        setError(result.error);
        setBusy(false);
        return;
      }
      await invoke("begin_live_updates", { token: result.token });
      localStorage.setItem(
        LOCAL_CAPTURE_STORAGE_KEY,
        JSON.stringify({ dealId: result.dealId, token: result.token, startedAt: Date.now() })
      );
      window.dispatchEvent(new Event(LOCAL_CAPTURE_EVENT));
      router.push(`/deals/${result.dealId}`);
    } catch (err) {
      await invoke("discard_local_capture").catch(() => {});
      setError(err instanceof Error ? err.message : "Couldn't start recording");
      setBusy(false);
    }
  }

  if (!isTauri) return null;

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={handleClick} className="btn btn-secondary btn-sm w-full justify-center">
        {busy ? "Starting…" : "Record another call"}
      </button>
      {error && <div className="chip chip-warn w-fit px-3 py-2 text-[12.5px]">{error}</div>}
    </div>
  );
}
