import RingChart from "./RingChart";

type Month = { key: string; label: string; value: number };

// The restyled "Deal value by month" card — same bar-chart/RingChart data
// and logic as the old inline version, now a real glass surface. No
// colored accent anywhere (no orb, no green/violet) — pure white-on-dark
// liquid glass, matching the Mail-app reference popup's restraint rather
// than the earlier colorful "Project Progress" motif. Uses the
// always-dark --glow-dark-surface* tokens (not --surface-inverted, which
// flips light in dark theme — right for a single accent card like
// UpgradeCard.tsx, wrong once there are several "featured" dark glass
// cards on one dark-themed page).
export default function DealValueHeroCard({
  months,
  maxMonthValue,
  currentMonthKey,
  signedRate,
  signedCount,
  dealCount,
}: {
  months: Month[];
  maxMonthValue: number;
  currentMonthKey: string;
  signedRate: number;
  signedCount: number;
  dealCount: number;
}) {
  return (
    <div className="glass-card card-hover relative p-5" style={{ border: "1px solid transparent" }}>
      <div className="glass-card-blur" aria-hidden="true" style={{ background: "var(--glow-dark-surface)" }} />

      <div className="relative z-10 mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-medium" style={{ color: "var(--on-glow-dark)" }}>
          Deal value by month
        </h2>
        <div className="flex items-center gap-2.5">
          <RingChart pct={signedRate} color="var(--on-glow-dark)" track="var(--glow-dark-surface-2)" />
          <div className="leading-tight">
            <div className="font-mono-tab text-[15px] font-semibold" style={{ color: "var(--on-glow-dark)" }}>
              {signedRate}%
            </div>
            <div className="text-[11px]" style={{ color: "var(--on-glow-dark-muted)" }}>
              signed
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar reusing the same signedRate data as the ring above —
          plain white fill, no color, matching the reference's restraint. */}
      <div className="relative z-10 mb-5">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--glow-dark-surface-2)" }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(4, signedRate)}%`, background: "var(--on-glow-dark)" }}
          />
        </div>
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--on-glow-dark-muted)" }}>
          {signedCount} of {dealCount} deals signed
        </div>
      </div>

      <div className="relative z-10 flex h-[160px] items-end gap-3">
        {months.map((m) => {
          const heightPct = maxMonthValue > 0 ? Math.max(4, Math.round((m.value / maxMonthValue) * 100)) : 4;
          const isCurrent = m.key === currentMonthKey;
          return (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-[120px] w-full items-end">
                <div
                  className="w-full rounded-t-[6px] transition-all duration-500 ease-out"
                  style={{
                    height: `${heightPct}%`,
                    background: isCurrent ? "var(--on-glow-dark)" : "var(--glow-dark-surface-2)",
                  }}
                  title={`$${m.value.toLocaleString()}`}
                />
              </div>
              <span className="text-[11.5px]" style={{ color: isCurrent ? "var(--on-glow-dark)" : "var(--on-glow-dark-muted)" }}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
