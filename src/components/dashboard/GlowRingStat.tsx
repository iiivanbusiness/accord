import RingChart from "./RingChart";

// The glowing ring/capsule widget from the reference images — a dark
// glass capsule with RingChart inside plus a matching glow. `tone` picks
// the accent; `pct` drives the ring itself (0-100, clamped in RingChart
// already). Only two tones exist app-wide (green = success, violet =
// everything else) — deliberately not a distinct hue per widget, so this
// stays part of the page's restrained two-accent palette, not a third.
const TONE = {
  green: { ring: "var(--status-signed)", glow: "var(--status-signed)" },
  violet: { ring: "var(--gradient-violet)", glow: "var(--gradient-violet)" },
} as const;

export default function GlowRingStat({
  pct,
  value,
  label,
  tone,
}: {
  pct: number;
  value: string;
  label: string;
  tone: keyof typeof TONE;
}) {
  const { ring, glow } = TONE[tone];
  return (
    // Flat --glow-dark-surface + a glow orb (same recipe as UpgradeCard.tsx,
    // but always-dark in both themes — see the token's own comment in
    // globals.css). No live backdrop-filter here — it's an opaque dark
    // capsule, nothing behind it to blur, keeps this widget out of the
    // backdrop-filter performance budget entirely.
    <div
      className="glass-card relative flex flex-1 items-center gap-3 px-4 py-3.5"
      style={{ background: "var(--glow-dark-surface)", border: "1px solid transparent" }}
    >
      <div className="glass-card-glow" style={{ background: glow, width: 80, height: 80, left: -24, top: -24, opacity: 0.4 }} aria-hidden="true" />
      <div className="relative z-10 flex-none" style={{ filter: `drop-shadow(0 0 8px ${glow})` }}>
        <RingChart pct={pct} size={44} stroke={4.5} color={ring} track="var(--glow-dark-surface-2)" />
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
