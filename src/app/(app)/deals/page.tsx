import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace, requireWorkspaceId } from "@/lib/workspace";
import DealsBulkTable from "@/components/DealsBulkTable";
import { bulkRemind, bulkSend } from "./bulk-actions";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  extraction_failed: "Couldn't process call",
  ready: "Ready for review",
  pending_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  sent: "Sent — awaiting signature",
  signed: "Signed",
};

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  extraction_failed: "chip-warn",
  ready: "chip-active",
  pending_approval: "chip-neutral",
  changes_requested: "chip-warn",
  sent: "chip-neutral",
  signed: "chip-success",
};

const BOARD_COLUMNS = ["processing", "missing_info", "extraction_failed", "ready", "pending_approval", "changes_requested", "sent", "signed"] as const;

const BOARD_COLUMN_LABEL: Record<string, string> = {
  processing: "Analyzing",
  missing_info: "Missing info",
  extraction_failed: "Couldn't process",
  ready: "Ready",
  pending_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  sent: "Sent",
  signed: "Signed",
};

function ViewTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-sm"
      style={active ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isBoard = view === "board";
  const workspaceId = await requireWorkspaceId();
  const [workspace, deals] = await Promise.all([
    requireWorkspace(),
    prisma.deal.findMany({
      where: { workspaceId },
      include: { client: true, contract: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const tableRows = deals.map((deal) => ({
    id: deal.id,
    clientName: deal.client.name,
    service: deal.service,
    feeDisplay: deal.feeDisplay,
    statusLabel: STATUS_LABEL[deal.status] ?? deal.status,
    statusChip: STATUS_CHIP[deal.status] ?? "chip-neutral",
    updatedAgo: timeAgo(deal.updatedAt),
    canRemind: deal.contract?.status === "sent" && Boolean(deal.client.email),
    canSend: deal.contract?.status === "draft" && Boolean(deal.client.email),
  }));

  const byColumn = new Map<string, typeof deals>();
  for (const col of BOARD_COLUMNS) byColumn.set(col, []);
  for (const deal of deals) {
    if (!byColumn.has(deal.status)) byColumn.set(deal.status, []);
    byColumn.get(deal.status)!.push(deal);
  }

  return (
    <>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Deals</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          {deals.length} active — from first call to signed contract
        </div>
      </div>
      <Link href="/deals/new" className="btn btn-primary">
        + Start a call
      </Link>
    </div>

    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
        Connected to Zoom — new calls are picked up and analyzed automatically
        {workspace && (
          <span className="ml-2" style={{ color: "var(--ink-muted)" }}>
            · {workspace.callsUsedThisMonth} of {workspace.callsLimit} calls used this month
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <ViewTab href="/deals" active={!isBoard}>Table</ViewTab>
        <ViewTab href="/deals?view=board" active={isBoard}>Board</ViewTab>
      </div>
    </div>

    {isBoard ? (
      <div className="flex gap-3.5 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((col) => {
          const colDeals = byColumn.get(col) ?? [];
          return (
            <div key={col} className="flex w-[240px] flex-none flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  {BOARD_COLUMN_LABEL[col]}
                </span>
                <span className="font-mono-tab text-[11.5px]" style={{ color: "var(--ink-muted)" }}>{colDeals.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colDeals.map((deal) => (
                  <Link key={deal.id} href={`/deals/${deal.id}`} className="card flex flex-col gap-1 p-3.5" style={{ color: "inherit" }}>
                    <span className="text-[13px] font-medium">{deal.client.name}</span>
                    <span className="truncate text-[12px]" style={{ color: "var(--ink-muted)" }}>{deal.service || "—"}</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono-tab text-[12px] font-medium">{deal.feeDisplay || "—"}</span>
                      <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{timeAgo(deal.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
                {colDeals.length === 0 && (
                  <div className="rounded-[12px] px-3 py-4 text-center text-[12px]" style={{ border: "1px dashed var(--hairline)", color: "var(--ink-muted)" }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <DealsBulkTable rows={tableRows} remindAction={bulkRemind} sendAction={bulkSend} />
    )}
    </>
  );
}
