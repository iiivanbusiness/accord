"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const FIELDS = [
  { label: "Client", value: "Acme Fitness" },
  { label: "Service", value: "Social Media Mgmt." },
  { label: "Fee", value: "€2,500 / mo" },
  { label: "Duration", value: "3 months" },
];

const MISSING = ["Cancellation terms", "Client billing address"];

export default function CompanionPreview({ contractHref }: { contractHref: string }) {
  const [shown, setShown] = useState<boolean[]>(FIELDS.map(() => false));
  const [missingShown, setMissingShown] = useState(false);
  const [status, setStatus] = useState("Watching for deal terms…");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function play() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShown(FIELDS.map(() => false));
    setMissingShown(false);
    setStatus("Watching for deal terms…");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShown(FIELDS.map(() => true));
      setMissingShown(true);
      setStatus("Deal terms captured");
      return;
    }
    const schedule: [number, () => void][] = [
      [600, () => setShown((s) => [true, s[1], s[2], s[3]])],
      [1150, () => setShown((s) => [s[0], true, s[2], s[3]])],
      [1700, () => setShown((s) => [s[0], s[1], true, s[3]])],
      [2250, () => { setShown((s) => [s[0], s[1], s[2], true]); setStatus("Deal terms captured"); }],
      [2800, () => setMissingShown(true)],
    ];
    schedule.forEach(([delay, fn]) => timers.current.push(setTimeout(fn, delay)));
  }

  useEffect(() => {
    play();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="w-[280px] overflow-hidden rounded-[16px]"
      style={{
        background: "linear-gradient(155deg, var(--gradient-violet), #4a2fb8)",
        boxShadow: "0 0 0 0.5px rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,.16)" }}>
        <h2 className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#fff" }}>
          <span className="chip-dot" style={{ background: "#fff", animation: "pulse 1.4s ease-in-out infinite" }} />
          Accord Companion
        </h2>
        <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>{status}</span>
      </div>

      <div className="px-4 py-2.5">
        {FIELDS.map((field, i) => (
          <div key={field.label} className={`companion-field flex items-center justify-between py-1.5 ${shown[i] ? "shown" : ""}`}>
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,.7)" }}>{field.label}</span>
            <span className="text-[12px] font-semibold" style={{ color: "#fff" }}>{field.value}</span>
          </div>
        ))}
      </div>

      <div className={`companion-field border-t px-4 py-2.5 ${missingShown ? "shown" : ""}`} style={{ borderColor: "rgba(255,255,255,.16)" }}>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>
          Missing information
        </div>
        {MISSING.map((item) => (
          <div key={item} className="flex items-center gap-1.5 py-0.5 text-[12px]" style={{ color: "#fff" }}>
            <span className="h-1 w-1 flex-none rounded-full" style={{ background: "var(--warn)" }} />
            {item}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 p-4 pt-3">
        <Link
          href={contractHref}
          className="w-full rounded-full py-2 text-center text-[12px] font-semibold"
          style={{ background: "#fff", color: "#1a0e42" }}
        >
          View full contract
        </Link>
        <button
          onClick={play}
          className="w-full rounded-full py-1.5 text-[11.5px] font-medium"
          style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}
        >
          Replay
        </button>
      </div>
    </div>
  );
}
