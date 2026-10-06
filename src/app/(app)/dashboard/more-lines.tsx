import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/deal-status";
import { dayInZone } from "@/lib/viewer-time";
import DealValueHeroCard from "@/components/dashboard/DealValueHeroCard";
import DashboardNotifications from "@/components/DashboardNotifications";
import type { DashboardLine } from "@/components/DashboardLines";
import type { LineId } from "@/lib/dashboard-lines";

const DAY = 24 * 60 * 60 * 1000;
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const muted = (text: React.ReactNode) => (
  <div className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--ink-muted)" }}>{text}</div>
);
const footerLink = (href: string, label: string) => (
  <Link href={href} className="block px-4 py-3 text-[13px] font-medium sm:px-5" style={{ borderTop: "1px solid var(--hairline-soft)", color: "var(--accent-blue)" }}>
    {label}
  </Link>
);
const rowStyle = (i: number) => (i ? { borderTop: "1px solid var(--hairline-soft)" } : undefined);

function ago(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / DAY);
  if (days < 1) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

// Deals, renewals and the month-by-month chart, each as a line.
export async function dealLines({ workspaceId, tz, need }: { workspaceId: string; tz: string; need: Set<LineId> }): Promise<DashboardLine[]> {
  if (!need.has("deals") && !need.has("renewals") && !need.has("deal-value")) return [];
  const now = new Date();
  const { where: visibility } = await dealVisibilityFilter();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const staleCutoff = new Date(now.getTime() - 7 * DAY);

  const [deals, signedThisMonth, renewals] = await Promise.all([
    // Only the columns shown: a full Deal row carries the whole transcript.
    prisma.deal.findMany({
      where: { workspaceId, trashedAt: null, ...visibility },
      select: { id: true, status: true, service: true, feeDisplay: true, createdAt: true, updatedAt: true, client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contract.count({ where: { signedAt: { gte: monthStart }, deal: { workspaceId, trashedAt: null, ...visibility } } }),
    need.has("renewals")
      ? prisma.contract.findMany({
          where: { status: "signed", renewalDate: { gte: now, lte: new Date(now.getTime() + 90 * DAY) }, deal: { workspaceId, trashedAt: null, ...visibility } },
          select: { id: true, dealId: true, autoRenews: true, renewalDate: true, deal: { select: { feeDisplay: true, client: { select: { name: true } } } } },
          orderBy: { renewalDate: "asc" },
        })
      : [],
  ]);

  const lines: DashboardLine[] = [];
  const openDeals = deals.filter((d) => d.status !== "signed");
  const openValue = openDeals.reduce((s, d) => s + parseFee(d.feeDisplay), 0);
  const stuck = deals.filter((d) => (d.status === "ready" || d.status === "missing_info") && d.updatedAt <= staleCutoff).sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  if (need.has("deals")) {
    const dealRow = (d: (typeof deals)[number], i: number, right: React.ReactNode) => (
      <Link key={d.id} href={`/deals/${d.id}`} className="row-hover flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={rowStyle(i)}>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{d.client.name}</div>
          <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{[d.service, d.feeDisplay].filter(Boolean).join(" · ")}</div>
        </div>
        {right}
      </Link>
    );
    const heading = (text: string) => (
      <div className="px-4 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase sm:px-5" style={{ letterSpacing: "0.6px", color: "var(--ink-muted)" }}>{text}</div>
    );
    lines.push({
      id: "deals",
      tone: stuck.length ? "due" : deals.length ? "good" : "quiet",
      summary: deals.length
        ? [`${money(openValue)} open`, `${signedThisMonth.toLocaleString("en-US")} signed this month`, stuck.length && `${stuck.length.toLocaleString("en-US")} stuck`].filter(Boolean).join(" · ")
        : "No deals yet",
      meta: deals.length ? `${openDeals.length.toLocaleString("en-US")} open` : undefined,
      body:
        deals.length === 0 ? (
          muted("Deals show up here after a sales call.")
        ) : (
          <div>
            {stuck.length > 0 && (
              <>
                {heading("Stuck: untouched 7+ days")}
                <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>
                  {stuck.slice(0, 5).map((d, i) => dealRow(d, i, <span className="chip chip-warn flex-none">{ago(d.updatedAt)}</span>))}
                </div>
              </>
            )}
            {heading("Latest")}
            <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>
              {deals.slice(0, 6).map((d, i) =>
                dealRow(d, i, <span className={`chip flex-none whitespace-nowrap ${STATUS_CHIP[d.status] ?? "chip-neutral"}`}>{STATUS_LABEL[d.status] ?? d.status}</span>),
              )}
            </div>
            {footerLink("/deals", "All deals")}
          </div>
        ),
    });
  }

  if (need.has("renewals")) {
    const atRisk = renewals.reduce((s, c) => s + parseFee(c.deal.feeDisplay), 0);
    const soon = renewals.filter((c) => (c.renewalDate as Date).getTime() - now.getTime() <= 30 * DAY);
    lines.push({
      id: "renewals",
      tone: soon.length ? "due" : "quiet",
      summary: renewals.length
        ? `${renewals.length.toLocaleString("en-US")} in the next 90 days · ${money(atRisk)}${soon.length ? ` · ${soon.length.toLocaleString("en-US")} within 30 days` : ""}`
        : "Nothing renewing in the next 90 days",
      body:
        renewals.length === 0
          ? muted("Signed contracts with a renewal date show up here 90 days ahead.")
          : renewals.slice(0, 10).map((c, i) => {
              const days = Math.ceil(((c.renewalDate as Date).getTime() - now.getTime()) / DAY);
              return (
                <Link key={c.id} href={`/deals/${c.dealId}/contract`} className="row-hover flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={rowStyle(i)}>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium" style={{ color: "var(--ink)" }}>{c.deal.client.name}</div>
                    <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                      {c.autoRenews ? "Auto-renews" : "Term ends"} {(c.renewalDate as Date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}
                    </div>
                  </div>
                  <span className={`chip flex-none ${days <= 30 ? "chip-warn" : "chip-neutral"}`}>in {days}d</span>
                </Link>
              );
            }),
    });
  }

  if (need.has("deal-value")) {
    const months: { key: string; label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-US", { month: "short" }), value: 0 });
    }
    for (const deal of deals) {
      const bucket = months.find((m) => m.key === `${deal.createdAt.getFullYear()}-${deal.createdAt.getMonth()}`);
      if (bucket) bucket.value += parseFee(deal.feeDisplay);
    }
    const signedCount = deals.filter((d) => d.status === "signed").length;
    const signedRate = deals.length ? Math.round((signedCount / deals.length) * 100) : 0;
    const current = months[months.length - 1];
    lines.push({
      id: "deal-value",
      tone: "quiet",
      summary: `${money(current.value)} this month · ${signedRate}% of deals signed`,
      body: (
        <div className="h-[300px] p-3 sm:p-4">
          <DealValueHeroCard
            months={months}
            maxMonthValue={Math.max(...months.map((m) => m.value), 1)}
            currentMonthKey={current.key}
            signedRate={signedRate}
            signedCount={signedCount}
            dealCount={deals.length}
          />
        </div>
      ),
    });
  }

  return lines;
}

// What's on the calendar over the next week.
export async function calendarLine({ workspaceId, tz, need }: { workspaceId: string; tz: string; need: Set<LineId> }): Promise<DashboardLine[]> {
  if (!need.has("calendar")) return [];
  const now = new Date();
  const events = await prisma.calendarEvent.findMany({
    where: { workspaceId, startTime: { gte: new Date(now.getTime() - 30 * 60 * 1000), lt: new Date(now.getTime() + 7 * DAY) } },
    orderBy: { startTime: "asc" },
    select: { id: true, title: true, clientName: true, startTime: true },
    take: 6,
  });
  const today = dayInZone(now, tz);
  const tomorrow = dayInZone(new Date(now.getTime() + DAY), tz);
  const when = (d: Date) => {
    const day = dayInZone(d, tz);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
    const label = day === today ? "today" : day === tomorrow ? "tomorrow" : new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d);
    return `${label} ${time}`;
  };
  const first = events[0];
  return [
    {
      id: "calendar",
      tone: first && dayInZone(first.startTime, tz) === today ? "due" : "quiet",
      summary: first ? `${first.title} · ${when(first.startTime)}` : "Nothing scheduled this week",
      body: (
        <div>
          {events.length === 0
            ? muted("Nothing scheduled in the next 7 days.")
            : events.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={rowStyle(i)}>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{e.title}</div>
                    {e.clientName && <div className="truncate text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{e.clientName}</div>}
                  </div>
                  <span className="flex-none text-[12.5px] tabular-nums" style={{ color: "var(--ink-muted)" }}>{when(e.startTime)}</span>
                </div>
              ))}
          {footerLink("/calendar", "Open calendar")}
        </div>
      ),
    },
  ];
}

// The person's latest notifications; unread ones make the line blue.
export async function notificationsLine({ userId, need }: { userId: string; need: Set<LineId> }): Promise<DashboardLine[]> {
  if (!need.has("notifications")) return [];
  const [unread, rows] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const latestUnread = rows.find((r) => !r.readAt);
  return [
    {
      id: "notifications",
      tone: unread ? "new" : "quiet",
      summary: unread ? `${unread.toLocaleString("en-US")} new${latestUnread ? ` · ${latestUnread.body || latestUnread.title}` : ""}` : "Nothing new",
      body: (
        <DashboardNotifications
          items={rows.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            body: r.body,
            linkUrl: r.linkUrl,
            readAt: r.readAt ? r.readAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      ),
    },
  ];
}
