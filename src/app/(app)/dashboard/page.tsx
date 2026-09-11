import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";
import { requireWorkspaceId } from "@/lib/workspace";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { STATUS_LABEL, BOARD_COLUMNS } from "@/lib/deal-status";
import GlassStatCard from "@/components/dashboard/GlassStatCard";
import DealStatusFolders from "@/components/dashboard/DealStatusFolders";
import DealValueHeroCard from "@/components/dashboard/DealValueHeroCard";
import GlowRingStat from "@/components/dashboard/GlowRingStat";

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

function formatEventDay(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// Chip-tone map kept local — only used for the Recent deals table below.
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

export default async function DashboardPage() {
  const now = new Date();
  const [workspaceId, session] = await Promise.all([requireWorkspaceId(), auth()]);
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;
  const { where: visibility } = await dealVisibilityFilter();

  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [deals, clientCount, upcomingEvents, renewalsAtRisk, staleDeals] = await Promise.all([
    prisma.deal.findMany({ where: { workspaceId, ...visibility }, include: { client: true, contract: true }, orderBy: { updatedAt: "desc" } }),
    prisma.client.count({ where: { workspaceId } }),
    prisma.calendarEvent.findMany({ where: { workspaceId, startTime: { gte: now } }, orderBy: { startTime: "asc" }, take: 5 }),
    prisma.contract.findMany({
      where: { status: "signed", renewalDate: { gte: now, lte: in90Days }, deal: { workspaceId, ...visibility } },
      include: { deal: { include: { client: true } } },
      orderBy: { renewalDate: "asc" },
    }),
    prisma.deal.findMany({
      where: { workspaceId, status: { in: ["ready", "missing_info"] }, updatedAt: { lte: staleCutoff }, ...visibility },
      include: { client: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const revenueAtRisk = renewalsAtRisk.reduce((sum, c) => sum + parseFee(c.deal.feeDisplay), 0);
  const upcomingRenewals = renewalsAtRisk.slice(0, 5);

  const signedCount = deals.filter((d) => d.status === "signed").length;
  const combinedValue = deals.reduce((sum, d) => sum + parseFee(d.feeDisplay), 0);
  const newClientsThisMonth = deals.filter(
    (d) => d.createdAt.getMonth() === now.getMonth() && d.createdAt.getFullYear() === now.getFullYear()
  ).length;

  const months: { key: string; label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }), value: 0 });
  }
  for (const deal of deals) {
    const key = `${deal.createdAt.getFullYear()}-${deal.createdAt.getMonth()}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.value += parseFee(deal.feeDisplay);
  }
  const maxMonthValue = Math.max(...months.map((m) => m.value), 1);
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const signedRate = deals.length > 0 ? Math.round((signedCount / deals.length) * 100) : 0;
  const newClientsPct = clientCount > 0 ? Math.round((newClientsThisMonth / clientCount) * 100) : 0;

  const recentDeals = deals.slice(0, 8);

  // Folders-by-status — reuses the `deals` array already fetched above
  // (dealVisibilityFilter already applied to it), no new query. Always all
  // 8 statuses, in canonical order, so a status with zero deals still
  // renders (dimmed) rather than silently disappearing from the grid.
  const statusCounts = new Map<string, number>();
  for (const col of BOARD_COLUMNS) statusCounts.set(col, 0);
  for (const deal of deals) statusCounts.set(deal.status, (statusCounts.get(deal.status) ?? 0) + 1);
  const statusFolderCounts = BOARD_COLUMNS.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  return (
    <>
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>
          {firstName ? `Hello, ${firstName}` : "Dashboard"}
        </h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          Everything happening across your workspace
        </div>
      </div>
      <div className="flex gap-2.5">
        <a href="https://meet.google.com" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          Google Meet
        </a>
        <a href="https://zoom.us" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          Zoom
        </a>
        <Link href="/deals/new" className="btn btn-primary">
          + Start a call
        </Link>
      </div>
    </div>

    {/* Stays within AppShell's normal max-w-[1180px] content column, same
        as every other page — an earlier full-bleed breakout here ignored
        the sidebar's width and produced a horizontal scrollbar. */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <GlassStatCard label="Combined deal value" value={`$${combinedValue.toLocaleString()}`} sub="Across all deals" />
          <GlassStatCard label="Active deals" value={String(deals.length)} sub={`${newClientsThisMonth} started this month`} />
          <GlassStatCard label="Contracts signed" value={String(signedCount)} sub={`of ${deals.length} deals`} />
          <GlassStatCard label="Clients" value={String(clientCount)} sub="Total on file" />
          <GlassStatCard
            label="Renewals at risk"
            value={String(renewalsAtRisk.length)}
            sub={renewalsAtRisk.length > 0 ? `$${revenueAtRisk.toLocaleString()} in 90 days` : "None in the next 90 days"}
          />
          <GlassStatCard
            label="Stuck deals"
            value={String(staleDeals.length)}
            sub={staleDeals.length > 0 ? "Untouched 7+ days" : "Nothing sitting idle"}
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Deals by status
          </h2>
          <DealStatusFolders counts={statusFolderCounts} />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <DealValueHeroCard
            months={months}
            maxMonthValue={maxMonthValue}
            currentMonthKey={currentMonthKey}
            signedRate={signedRate}
            signedCount={signedCount}
            dealCount={deals.length}
          />

          <div className="glass-card glass-card-solid card-hover p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">Upcoming calls</h2>
              <Link href="/calendar" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
                View all
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="py-6 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Nothing scheduled yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--hairline-soft)" }}>
                    <div
                      className="font-mono-tab flex w-[64px] flex-none flex-col items-start rounded-[8px] px-2 py-1 text-[11.5px] font-medium"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {formatEventDay(event.startTime)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{event.title}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                        {formatEventTime(event.startTime)} · {event.clientName ?? "No client"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="glass-card glass-card-solid card-hover p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium">Upcoming renewals</h2>
              {renewalsAtRisk.length > 0 && (
                <span className="chip chip-warn flex-none" style={{ fontSize: 11 }}>
                  ${revenueAtRisk.toLocaleString()} in 90 days
                </span>
              )}
            </div>
            {upcomingRenewals.length === 0 ? (
              <div className="py-6 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
                No contracts renewing soon.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {upcomingRenewals.map((contract) => (
                  <Link
                    key={contract.id}
                    href={`/deals/${contract.dealId}/contract`}
                    className="flex items-center gap-3 border-t py-2.5 first:border-t-0"
                    style={{ borderColor: "var(--hairline-soft)", color: "inherit" }}
                  >
                    <div
                      className="font-mono-tab flex w-[64px] flex-none flex-col items-start rounded-[8px] px-2 py-1 text-[11.5px] font-medium"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {daysUntil(contract.renewalDate as Date)}d
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{contract.deal.client.name}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                        {contract.autoRenews ? "Auto-renews" : "Term ends"} {(contract.renewalDate as Date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </Link>
                ))}
                {renewalsAtRisk.length > upcomingRenewals.length && (
                  <div className="pt-2 text-center text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                    +{renewalsAtRisk.length - upcomingRenewals.length} more in the next 90 days
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card glass-card-solid card-hover p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium">Stuck deals</h2>
              {staleDeals.length > 0 && (
                <span className="chip chip-warn flex-none" style={{ fontSize: 11 }}>
                  {staleDeals.length} untouched 7+ days
                </span>
              )}
            </div>
            {staleDeals.length === 0 ? (
              <div className="py-6 text-center text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Nothing sitting idle — nice.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {staleDeals.slice(0, 5).map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="flex items-center gap-3 border-t py-2.5 first:border-t-0"
                    style={{ borderColor: "var(--hairline-soft)", color: "inherit" }}
                  >
                    <div
                      className="font-mono-tab flex w-[64px] flex-none flex-col items-start rounded-[8px] px-2 py-1 text-[11.5px] font-medium"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {timeAgo(deal.updatedAt)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{deal.client.name}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                        {STATUS_LABEL[deal.status] ?? deal.status}
                      </div>
                    </div>
                  </Link>
                ))}
                {staleDeals.length > 5 && (
                  <div className="pt-2 text-center text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                    +{staleDeals.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[15px] font-medium">This month</h2>
            <GlowRingStat pct={signedRate} value={`${signedRate}%`} label="Signed rate" />
            <GlowRingStat pct={newClientsPct} value={String(newClientsThisMonth)} label="New clients this month" />
          </div>
        </div>

        <div className="glass-card glass-card-solid card-hover overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
            <h2 className="text-[15px] font-medium">Recent deals</h2>
            <Link href="/deals" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Client", "Value", "Status", "Updated"].map((h) => (
                    <th
                      key={h}
                      className="border-b px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDeals.map((deal) => (
                  <tr key={deal.id} className="row-hover transition-colors">
                    <td className="border-b px-5 py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
                      <Link href={`/deals/${deal.id}`} className="flex flex-col gap-0.5" style={{ color: "inherit" }}>
                        <span className="font-medium" style={{ color: "var(--ink)" }}>{deal.client.name}</span>
                        <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{deal.service}</span>
                      </Link>
                    </td>
                    <td className="font-mono-tab border-b px-5 py-3.5 font-medium" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink)" }}>
                      {deal.feeDisplay}
                    </td>
                    <td className="border-b px-5 py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
                      <span className={`chip ${STATUS_CHIP[deal.status] ?? "chip-neutral"}`}>
                        <span className="chip-dot" />
                        {STATUS_LABEL[deal.status] ?? deal.status}
                      </span>
                    </td>
                    <td className="border-b px-5 py-3.5 text-[13px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
                      {timeAgo(deal.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
}
