import Reveal from "@/components/Reveal";

const COLUMNS = [
  { label: "The call", body: "Accord sits inside your Zoom or Meet call. It hears the terms as they're said. No notes needed.", Stage: CallStage },
  { label: "The draft", body: "The moment terms are confirmed, Accord assembles the agreement from your templates, clause by clause.", Stage: DraftStage },
  { label: "The signature", body: "The finished contract goes out for signature immediately. Signed before the call ends.", Stage: SignStage },
];

export default function HowItWorksPanels() {
  return (
    <Reveal>
      <div className="relative">
        <div className="aurora-band" aria-hidden="true" />

        <div className="relative grid grid-cols-1 md:grid-cols-3" style={{ borderTop: "1px solid var(--hairline)" }}>
          {COLUMNS.map((col, i) => (
            <div
              key={col.label}
              className="flex flex-col p-6 md:p-8"
              style={{ borderTop: "1px solid var(--hairline)", borderLeft: i > 0 ? "1px solid var(--hairline)" : "none" }}
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                {col.label}
              </div>
              <p className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
                {col.body}
              </p>
              <div className="mt-auto">
                <col.Stage />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-[14px]"
      style={{
        background: "radial-gradient(120% 100% at 50% 15%, rgba(255,255,255,0.035), transparent 60%), var(--surface-1)",
        border: "1px solid var(--hairline)",
      }}
    >
      {children}
    </div>
  );
}

const WAVE_HEIGHTS = [22, 34, 46, 32, 42, 58, 40, 28, 50, 66, 44, 30, 48, 62, 38, 24, 34, 52, 44, 30, 56, 40, 26, 36];

function CallStage() {
  return (
    <Stage>
      <div
        className="wave-glow pointer-events-none absolute h-[120px] w-[120px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(0,153,255,0.28), transparent 72%)", filter: "blur(6px)" }}
      />
      <span
        className="chip chip-neutral absolute left-3 top-3"
        style={{ fontSize: "10px", padding: "3px 8px 3px 7px", gap: "5px" }}
      >
        <span className="chip-dot" style={{ background: "var(--accent-blue)", animation: "pulse 1.4s ease-in-out infinite" }} />
        Listening
      </span>

      <span className="wave-spark" style={{ left: "28%", animationDelay: "0s" }} aria-hidden="true" />
      <span className="wave-spark" style={{ left: "52%", animationDelay: "1.1s" }} aria-hidden="true" />
      <span className="wave-spark" style={{ left: "74%", animationDelay: "2.2s" }} aria-hidden="true" />

      <div className="relative flex h-[70px] items-end gap-[3px]">
        {WAVE_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="wave-bar"
            style={{ height: `${h}px`, animationDelay: `${i * 0.05}s`, animationDuration: `${0.95 + (i % 5) * 0.08}s` }}
          />
        ))}
      </div>
    </Stage>
  );
}

function DraftStage() {
  const lines = [
    { w: "92%", n: 1 },
    { w: "78%", n: 2 },
    { w: "86%", n: 3 },
    { w: "54%", n: 4 },
  ];
  return (
    <Stage>
      <div className="flex w-full flex-col gap-[11px] px-8">
        {lines.map((l) => (
          <div key={l.n} className="flex items-center gap-2">
            <span className={`draft-line draft-line-${l.n}`} style={{ width: l.w, height: 5 }} />
            <svg className={`draft-check draft-check-${l.n}`} width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="var(--success)" strokeWidth="2.6">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            {l.n === lines.length && (
              <span className="draft-cursor-wrap">
                <span className="draft-cursor" />
              </span>
            )}
          </div>
        ))}
      </div>
    </Stage>
  );
}

function SignStage() {
  const d = "M10 46 C 26 8, 48 8, 58 30 C 68 52, 82 12, 100 20 C 118 28, 128 56, 152 38 C 168 26, 178 44, 192 30";
  return (
    <Stage>
      <span className="sign-pulse sign-pulse-outer absolute h-[74px] w-[74px] rounded-full" style={{ border: "1.5px solid var(--success)" }} aria-hidden="true" />
      <span className="sign-pulse sign-pulse-inner absolute h-[74px] w-[74px] rounded-full" style={{ border: "1.5px solid var(--success)" }} aria-hidden="true" />
      <svg width="200" height="70" viewBox="0 0 200 70" fill="none">
        <path className="sign-draw sign-glow" d={d} stroke="var(--success)" strokeWidth="6" strokeLinecap="round" />
        <path className="sign-draw" d={d} stroke="var(--success)" strokeWidth="3" strokeLinecap="round" />
        <circle className="sign-ink-dot" cx="192" cy="30" r="3.5" fill="var(--success)" />
      </svg>
      <span className="sign-stamp chip chip-success absolute bottom-3 right-3" style={{ fontSize: "10.5px" }}>
        Signed
      </span>
    </Stage>
  );
}
