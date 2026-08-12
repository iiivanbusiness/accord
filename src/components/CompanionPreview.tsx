"use client";

import { useEffect, useRef, useState } from "react";

const FIELDS = [
  { label: "Client", value: "Acme Fitness" },
  { label: "Service", value: "Social Media Mgmt." },
  { label: "Fee", value: "€2,500 / mo" },
  { label: "Duration", value: "3 months" },
];

export default function CompanionPreview() {
  const [shown, setShown] = useState<boolean[]>(FIELDS.map(() => false));
  const [status, setStatus] = useState("Watching for deal terms…");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function play() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShown(FIELDS.map(() => false));
    setStatus("Watching for deal terms…");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShown(FIELDS.map(() => true));
      setStatus("Deal terms captured");
      return;
    }
    const schedule: [number, () => void][] = [
      [700, () => setShown((s) => [true, s[1], s[2], s[3]])],
      [1400, () => setShown((s) => [s[0], true, s[2], s[3]])],
      [2200, () => setShown((s) => [s[0], s[1], true, s[3]])],
      [3000, () => { setShown((s) => [s[0], s[1], s[2], true]); setStatus("Deal terms captured"); }],
    ];
    schedule.forEach(([delay, fn]) => timers.current.push(setTimeout(fn, delay)));
  }

  useEffect(() => {
    play();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="glass rounded-[20px]">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <span className="pill-dot" style={{ background: "var(--accent)", animation: "pulse 1.4s ease-in-out infinite" }} />
            Accord Companion
          </h2>
        </div>
        <div className="px-5 pb-0 pt-3">
          <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{status}</span>
        </div>
        <div className="px-5 py-3">
          {FIELDS.map((field, i) => (
            <div key={field.label} className={`companion-field flex items-center justify-between py-2 ${shown[i] ? "shown" : ""}`}>
              <span className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>{field.label}</span>
              <span className="text-[13.5px] font-semibold">{field.value}</span>
            </div>
          ))}
        </div>
        <div className="p-5 pt-2">
          <button
            onClick={play}
            className="w-full rounded-full border py-2 text-[12.5px] font-semibold"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            Replay
          </button>
        </div>
      </div>
      <div className="px-1 pt-3 text-center text-[12px] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
        Your existing Zoom or Meet call, completely unmodified — Accord isn&apos;t a participant and doesn&apos;t record anything on its own.
      </div>
    </div>
  );
}
