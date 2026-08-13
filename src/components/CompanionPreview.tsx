"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type Clause = { title: string; body: string };

const FIELDS = [
  { label: "Client", value: "Acme Fitness" },
  { label: "Service", value: "Social Media Mgmt." },
  { label: "Fee", value: "€2,500 / mo" },
  { label: "Duration", value: "3 months" },
];

const MISSING = ["Cancellation terms", "Client billing address"];

const GLASS_STYLE: React.CSSProperties = {
  background: "linear-gradient(155deg, rgba(106,76,245,0.50), rgba(74,47,184,0.50))",
  backdropFilter: "blur(18px) saturate(150%)",
  WebkitBackdropFilter: "blur(18px) saturate(150%)",
  boxShadow: "0 0 0 0.5px rgba(255,255,255,0.14), 0 10px 30px rgba(0,0,0,0.45)",
};

export default function CompanionPreview({ templateName, clauses }: { templateName: string; clauses: Clause[] }) {
  const [view, setView] = useState<"summary" | "contract">("summary");
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

  if (view === "contract") {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
      >
        <div className="flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-[16px]" style={GLASS_STYLE}>
          <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "rgba(255,255,255,.16)" }}>
            <button
              onClick={() => setView("summary")}
              className="flex items-center gap-1 text-[12.5px] font-semibold"
              style={{ color: "#fff" }}
            >
              ← Back to call
            </button>
            <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>{templateName}</span>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            {clauses.map((clause, i) => (
              <div key={clause.title} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-[13px] font-semibold" style={{ color: "#fff" }}>
                  {i + 1}. {clause.title}
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.78)" }}>{clause.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="absolute right-3 bottom-[98px] w-[260px] overflow-hidden rounded-[16px]" style={GLASS_STYLE}>
        <div className="border-b px-4 py-2" style={{ borderColor: "rgba(255,255,255,.16)" }}>
          <h2 className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "#fff" }}>
            <span className="chip-dot" style={{ background: "#fff", animation: "pulse 1.4s ease-in-out infinite" }} />
            Accord Companion
          </h2>
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,.7)" }}>{status}</span>
        </div>

        <div className="px-4 py-1.5">
          {FIELDS.map((field, i) => (
            <div key={field.label} className={`companion-field flex items-center justify-between py-1 ${shown[i] ? "shown" : ""}`}>
              <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>{field.label}</span>
              <span className="text-[11.5px] font-semibold" style={{ color: "#fff" }}>{field.value}</span>
            </div>
          ))}
        </div>

        <div className={`companion-field border-t px-4 py-2 ${missingShown ? "shown" : ""}`} style={{ borderColor: "rgba(255,255,255,.16)" }}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>
            Missing information
          </div>
          {MISSING.map((item) => (
            <div key={item} className="flex items-center gap-1.5 py-0.5 text-[11.5px]" style={{ color: "#fff" }}>
              <span className="h-1 w-1 flex-none rounded-full" style={{ background: "var(--warn)" }} />
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 p-3 pt-2">
          <button
            onClick={() => setView("contract")}
            className="w-full rounded-full py-1.5 text-[11.5px] font-semibold"
            style={{ background: "#fff", color: "#1a0e42" }}
          >
            View full contract
          </button>
          <button
            onClick={play}
            className="w-full rounded-full py-1 text-[11px] font-medium"
            style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}
          >
            Replay
          </button>
        </div>
      </div>
      <div className="absolute right-3 bottom-3">
        <div className="zoom-pip">
          <div className="z-avatar-sm">HM</div>
          <span className="name-tag-sm">Horizon Media</span>
        </div>
      </div>
    </Fragment>
  );
}
