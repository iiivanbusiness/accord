// Lifted verbatim from the old inline version in dashboard/page.tsx — zero
// logic change, just moved so both DealValueHeroCard and GlowRingStat can
// use it instead of the page defining it locally for one caller.
export default function RingChart({
  pct,
  size = 46,
  stroke = 5,
  color,
  track,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flex: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset .7s cubic-bezier(.2,.7,.3,1)" }}
      />
    </svg>
  );
}
