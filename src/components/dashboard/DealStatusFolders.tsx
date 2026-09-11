import Link from "next/link";
import { STATUS_LABEL } from "@/lib/deal-status";
import FolderIcon from "./FolderIcon";

export type StatusCount = { status: string; count: number };

// Finder-style icon grid — the same neutral glass folder for every status
// (see FolderIcon), title + count caption below, exactly like the
// reference's file-type grid. No per-cell chrome or tint — the folder
// graphic itself is the only thing that isn't flat page background.
export default function DealStatusFolders({ counts }: { counts: StatusCount[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-8">
      {counts.map(({ status, count }) => {
        const empty = count === 0;
        return (
          <Link
            key={status}
            href={`/deals?status=${status}`}
            className="card-hover flex flex-col items-center gap-2.5 rounded-[14px] px-2 py-4 text-center hover:bg-[var(--surface-1)]"
            style={{ opacity: empty ? 0.45 : 1 }}
          >
            <FolderIcon id={status} size={64} />
            <div>
              <div className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {STATUS_LABEL[status] ?? status}
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                {count} {count === 1 ? "deal" : "deals"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
