// Flat glass tile, deliberately no colored glow — the folder grid is the
// page's one colorful section; the 6 stat tiles stay restrained so they
// don't reintroduce the "too many colors" problem the redesign was
// rejected for. Value/label hierarchy carries the visual distinction.
export default function GlassStatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="glass-card-blur" aria-hidden="true" />
      <div className="relative z-10">
        <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {label}
        </div>
        <div className="font-mono-tab mt-2 text-[26px] font-medium">{value}</div>
        {sub && (
          <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
