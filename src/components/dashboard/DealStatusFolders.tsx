import Link from "next/link";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/deal-status-theme";

function iconProps() {
  return { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, width: 18, height: 18 };
}

// One small geometric icon per status — same 20x20/stroke-1.6 convention
// as AppShell.tsx's nav icons, just colored per status via the parent's
// `color: STATUS_COLOR[x]` rather than the neutral --ink-muted nav uses.
const STATUS_ICON: Record<string, React.ReactNode> = {
  processing: (
    <svg {...iconProps()}>
      <circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  missing_info: (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 13.2v.1M10 6.8c1.4 0 2.3.9 2.3 2 0 1.5-2.3 1.5-2.3 3.3" />
    </svg>
  ),
  extraction_failed: (
    <svg {...iconProps()}>
      <path d="M10 3l7.5 13H2.5L10 3z" />
      <path d="M10 8.5v3M10 14v.1" />
    </svg>
  ),
  ready: (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10l2 2 4-4.5" />
    </svg>
  ),
  pending_approval: (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" />
    </svg>
  ),
  changes_requested: (
    <svg {...iconProps()}>
      <path d="M12.8 3.5l3.7 3.7-9 9-4 .8.8-4 9-9z" />
    </svg>
  ),
  sent: (
    <svg {...iconProps()}>
      <path d="M3 10.5l14-7-5 14-2.8-5.2L3 10.5z" />
      <path d="M9.2 12.3l3.5-4.8" />
    </svg>
  ),
  signed: (
    <svg {...iconProps()}>
      <circle cx="10" cy="10" r="7" />
      <path d="M6.8 10.2l2.2 2.2 4.2-4.8" strokeWidth={1.8} />
    </svg>
  ),
};

export type StatusCount = { status: string; count: number };

// The new "folders by status" section — a glossy file-manager-style grid
// (reference: colorful 3D folder icons with counts), one card per real
// Deal.status, always all 8 (empty ones dim rather than hidden — keeps the
// pipeline shape honest). Reuses the already-fetched/visibility-filtered
// `deals` array from the page — no new query, see dashboard/page.tsx.
export default function DealStatusFolders({ counts }: { counts: StatusCount[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 xl:grid-cols-8">
      {counts.map(({ status, count }) => {
        const color = STATUS_COLOR[status];
        const empty = count === 0;
        return (
          <Link
            key={status}
            href={`/deals?status=${status}`}
            className="glass-card card-hover relative flex flex-col gap-3 p-4"
            style={{ opacity: empty ? 0.55 : 1 }}
          >
            <div className="glass-card-blur" aria-hidden="true" />
            <div
              className="glass-card-glow"
              style={{ background: color, width: 70, height: 70, right: -20, bottom: -20 }}
              aria-hidden="true"
            />
            <div
              className="relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
              style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            >
              {STATUS_ICON[status]}
            </div>
            <div className="relative z-10">
              <div className="font-mono-tab text-[22px] font-semibold" style={{ color: "var(--ink)" }}>
                {count}
              </div>
              <div className="truncate text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                {STATUS_LABEL[status] ?? status}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
