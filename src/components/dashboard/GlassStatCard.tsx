// Glass replacement for the old inline `StatCard` — identical props, so
// nothing calling it needs to change beyond the import. `glow` is purely
// decorative (a tinted blur orb bleeding from one corner); omit it for a
// plain glass tile.
export default function GlassStatCard({
  label,
  value,
  sub,
  glow,
}: {
  label: string;
  value: string;
  sub?: string;
  glow?: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="glass-card-blur" aria-hidden="true" />
      {glow && (
        <div
          className="glass-card-glow"
          style={{ background: glow, width: 90, height: 90, right: -30, bottom: -30 }}
          aria-hidden="true"
        />
      )}
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
