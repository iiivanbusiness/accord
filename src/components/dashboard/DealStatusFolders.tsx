import Link from "next/link";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/deal-status-theme";
import FolderIcon from "./FolderIcon";

export type StatusCount = { status: string; count: number };

// Finder-style icon grid — folder graphic centered, count as a badge
// overlapping its corner, label below. This is the one deliberately
// colorful section of the Dashboard (the folder fill), so the cell
// itself stays a plain hover target with no glass chrome or tinted
// background — otherwise the folders would sit on top of 8 more colors.
export default function DealStatusFolders({ counts }: { counts: StatusCount[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8">
      {counts.map(({ status, count }) => {
        const color = STATUS_COLOR[status];
        const empty = count === 0;
        return (
          <Link
            key={status}
            href={`/deals?status=${status}`}
            className="card-hover flex flex-col items-center gap-2 rounded-[14px] px-2 py-4 text-center hover:bg-[var(--surface-1)]"
            style={{ opacity: empty ? 0.5 : 1 }}
          >
            <div className="relative">
              <FolderIcon color={color} id={status} size={58} />
              <div
                className="font-mono-tab absolute -right-2 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                style={{ background: "rgba(0,0,0,0.72)", border: "1.5px solid rgba(255,255,255,0.5)" }}
              >
                {count}
              </div>
            </div>
            <div className="truncate text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
              {STATUS_LABEL[status] ?? status}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
