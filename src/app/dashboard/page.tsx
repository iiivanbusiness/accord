import Link from "next/link";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";
import { requireWorkspaceId } from "@/lib/workspace";

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

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call…",
  missing_info: "Missing info",
  ready: "Ready for review",
  sent: "Sent",
  signed: "Signed",
};

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  ready: "chip-active",
  sent: "chip-neutral",
  signed: "chip-success",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
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
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const workspaceId = await requireWorkspaceId();

  const [deals, clientCount, upcomingEvents] = await Promise.all([
    prisma.deal.findMany({ where: { workspaceId }, include: { client: true, contract: true }, orderBy: { updatedAt: "desc" } }),
    prisma.client.count({ where: { workspaceId } }),
    prisma.calendarEvent.findMany({ where: { workspaceId, startTime: { gte: now } }, orderBy: { startTime: "asc" }, take: 5 }),
  ]);

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

  const recentDeals = deals.slice(0, 5);

  return (
    <AppShell active="/dashboard" screenLabel="Dashboard">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Dashboard</h1>
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
            + Upload a call
          </Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Combined deal value" value={`€${combinedValue.toLocaleString()}`} sub="Across all deals" />
        <StatCard label="Active deals" value={String(deals.length)} sub={`${newClientsThisMonth} started this month`} />
        <StatCard label="Contracts signed" value={String(signedCount)} sub={`of ${deals.length} deals`} />
        <StatCard label="Clients" value={String(clientCount)} sub="Total on file" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[15px] font-medium">Deal value by month</h2>
          </div>
          <div className="flex h-[160px] items-end gap-3">
            {months.map((m) => {
              const heightPct = maxMonthValue > 0 ? Math.max(4, Math.round((m.value / maxMonthValue) * 100)) : 4;
              const isCurrent = m.key === currentMonthKey;
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-[120px] w-full items-end">
                    <div
                      className="w-full rounded-t-[6px] transition-all"
                      style={{
                        height: `${heightPct}%`,
                        background: isCurrent ? "var(--primary)" : "var(--surface-2)",
                      }}
                      title={`€${m.value.toLocaleString()}`}
                    />
                  </div>
                  <span className="text-[11.5px]" style={{ color: isCurrent ? "var(--ink)" : "var(--ink-muted)" }}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
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

      <div className="card overflow-hidden">
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
    </AppShell>
  );
}
