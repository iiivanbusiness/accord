import RingChart from "./RingChart";

// The ring/capsule widget from the reference images — a dark glass
// capsule with RingChart inside. No color: plain white ring on a dark
// glass track, matching the reference's monochrome liquid-glass look
// rather than the earlier per-widget accent hues.
export default function GlowRingStat({ pct, value, label }: { pct: number; value: string; label: string }) {
  return (
    <div
      className="glass-card relative flex flex-1 items-center gap-3 px-4 py-3.5"
      style={{ background: "var(--glow-dark-surface)", border: "1px solid transparent" }}
    >
      <div className="relative z-10 flex-none">
        <RingChart pct={pct} size={44} stroke={4.5} color="var(--on-glow-dark)" track="var(--glow-dark-surface-2)" />
      </div>
      <div className="relative z-10 min-w-0 leading-tight">
        <div className="font-mono-tab truncate text-[17px] font-semibold" style={{ color: "var(--on-glow-dark)" }}>
          {value}
        </div>
        <div className="truncate text-[11px]" style={{ color: "var(--on-glow-dark-muted)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}
