import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace, requireWorkspaceId } from "@/lib/workspace";
import { parseFee } from "@/lib/money";
import DealsBulkTable from "@/components/DealsBulkTable";
import DealsBoard from "@/components/DealsBoard";
import DealsFilterBar from "@/components/DealsFilterBar";
import { bulkRemind, bulkSend, updateDealStatus } from "./bulk-actions";
import { dealVisibilityFilter } from "@/lib/deal-visibility";

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_STATUSES = new Set(["ready", "missing_info"]);

function isDealStale(status: string, updatedAt: Date): boolean {
  return STALE_STATUSES.has(status) && Date.now() - updatedAt.getTime() > STALE_AFTER_MS;
}

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
  searchParams: Promise<{ view?: string; q?: string; status?: string; owner?: string }>;
}) {
  const { view, q, status, owner } = await searchParams;
  const isBoard = view === "board";
  const workspaceId = await requireWorkspaceId();
  const { where: visibility, canViewAll } = await dealVisibilityFilter();

  const filterWhere = {
    ...(status ? { status } : {}),
    ...(owner ? { ownerId: owner } : {}),
    ...(q
      ? {
          OR: [
            { client: { name: { contains: q, mode: "insensitive" as const } } },
            { service: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [workspace, deals, owners] = await Promise.all([
    requireWorkspace(),
    prisma.deal.findMany({
      where: { workspaceId, ...visibility, ...filterWhere },
      include: { client: true, contract: true, owner: true },
      orderBy: { updatedAt: "desc" },
    }),
    canViewAll ? prisma.user.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const tableRows = deals.map((deal) => ({
    id: deal.id,
    clientName: deal.client.name,
    service: deal.service,
    feeDisplay: deal.feeDisplay,
    feeValue: parseFee(deal.feeDisplay),
    statusLabel: STATUS_LABEL[deal.status] ?? deal.status,
    statusChip: STATUS_CHIP[deal.status] ?? "chip-neutral",
    updatedAgo: timeAgo(deal.updatedAt),
    updatedAt: deal.updatedAt.getTime(),
    ownerName: deal.owner?.name ?? null,
    isStale: isDealStale(deal.status, deal.updatedAt),
    canRemind: deal.contract?.status === "sent" && Boolean(deal.client.email),
    canSend: deal.contract?.status === "draft" && Boolean(deal.client.email),
  }));

  const byColumn: Record<string, { id: string; clientName: string; service: string; feeDisplay: string; updatedAgo: string }[]> = {};
  for (const col of BOARD_COLUMNS) byColumn[col] = [];
  for (const deal of deals) {
    if (!byColumn[deal.status]) byColumn[deal.status] = [];
    byColumn[deal.status].push({
      id: deal.id,
      clientName: deal.client.name,
      service: deal.service,
      feeDisplay: deal.feeDisplay,
      updatedAgo: timeAgo(deal.updatedAt),
    });
  }

  return (
    <>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Deals</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          {deals.length} {deals.length === 1 ? "deal" : "deals"} — from first call to signed contract
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

    <DealsFilterBar owners={owners} showOwnerFilter={canViewAll} />

    {isBoard ? (
      <DealsBoard byColumn={byColumn} updateStatusAction={updateDealStatus} />
    ) : (
      <DealsBulkTable rows={tableRows} remindAction={bulkRemind} sendAction={bulkSend} showOwnerColumn={canViewAll} />
    )}
    </>
  );
}
