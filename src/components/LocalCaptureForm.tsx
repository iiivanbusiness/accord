"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startLocalCapture } from "@/app/(app)/deals/new/actions";

type Template = { id: string; name: string };

export const LOCAL_CAPTURE_STORAGE_KEY = "sealme:local-capture";

export default function LocalCaptureForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);

  async function handleSubmit(formData: FormData) {
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
      const result = await startLocalCapture(formData);
      if ("error" in result) {
        await invoke("discard_local_capture").catch(() => {});
        setError(result.error);
        setBusy(false);
        return;
      }
      localStorage.setItem(
        LOCAL_CAPTURE_STORAGE_KEY,
        JSON.stringify({ dealId: result.dealId, token: result.token, startedAt: Date.now() })
      );
      router.push(`/deals/${result.dealId}`);
    } catch (err) {
      await invoke("discard_local_capture").catch(() => {});
      setError(err instanceof Error ? err.message : "Couldn't start recording");
      setBusy(false);
    }
  }

  if (isTauri === null) return null;

  if (!isTauri) {
    return (
      <div className="card max-w-[560px] p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Recording locally only works inside the SealMe desktop app — it captures your call&apos;s audio directly from
        your computer instead of using a bot.{" "}
        <Link href="/deals/new?mode=live" className="font-medium" style={{ color: "var(--accent-blue)" }}>
          Use a notetaker bot
        </Link>{" "}
        here instead.
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card flex max-w-[560px] flex-col gap-4 p-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Who are you meeting with?</span>
        <input name="clientName" placeholder="Acme Fitness" required className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Template</span>
        <select name="templateId" required className="input">
          <option value="" style={{ background: "var(--surface-1)" }}>
            Choose a template
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id} style={{ background: "var(--surface-1)" }}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {error && <div className="chip chip-warn w-fit px-3 py-2 text-[12.5px]">{error}</div>}

      <button type="submit" disabled={busy} className="btn btn-primary mt-2 w-full justify-center">
        {busy ? "Starting…" : "Start recording"}
      </button>
      <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
        SealMe records your system audio for this call — nothing joins the meeting. Stop the recording from the banner
        at the top once the call ends.
      </span>
    </form>
  );
}
