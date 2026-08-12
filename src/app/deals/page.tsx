import Link from "next/link";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

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
  ready: "Ready for review",
  sent: "Sent — awaiting signature",
  signed: "Signed",
};

export default async function DealsPage() {
  const workspace = await prisma.workspace.findFirst();
  const deals = await prisma.deal.findMany({
    include: { client: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell active="/deals" screenLabel="Deals">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-bold">Deals</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            {deals.length} active — from first call to signed contract
          </div>
        </div>
        <div className="flex gap-2.5">
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            Start on Google Meet
          </a>
          <a
            href="https://zoom.us/start/videomeeting"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            Start on Zoom
          </a>
          <Link
            href="/deals/new"
            className="rounded-full px-[18px] py-[10px] text-[13.5px] font-semibold"
            style={{
              background: "linear-gradient(160deg, var(--accent), var(--accent-strong))",
              color: "var(--accent-ink)",
              boxShadow: "0 4px 18px rgba(79,227,190,.32)",
            }}
          >
            + Upload a call
          </Link>
        </div>
      </div>

      <div className="mb-3.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        Connected to Zoom — new calls are picked up and analyzed automatically
        {workspace && (
          <span className="ml-2" style={{ color: "var(--ink-faint)" }}>
            · {workspace.callsUsedThisMonth} of {workspace.callsLimit} calls used this month
          </span>
        )}
      </div>

      <Link
        href="/deals/concept"
        className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold"
        style={{ borderColor: "var(--glass-border-soft)", background: "var(--glass)", color: "var(--ink-muted)" }}
      >
        See how this looks next to a real Zoom call
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4l6 6-6 6" /></svg>
      </Link>

      <div className="glass overflow-hidden rounded-[20px]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Client", "Value", "Status", "Updated"].map((h) => (
                  <th
                    key={h}
                    className="border-b px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--ink-faint)", borderColor: "var(--glass-border-soft)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="transition-colors hover:bg-white/[0.04]">
                  <td className="border-b px-5 py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
                    <Link href={`/deals/${deal.id}`} className="flex flex-col gap-0.5">
                      <span className="font-semibold">{deal.client.name}</span>
                      <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{deal.service}</span>
                    </Link>
                  </td>
                  <td className="font-mono-tab border-b px-5 py-4 font-semibold" style={{ borderColor: "var(--glass-border-soft)" }}>
                    {deal.feeDisplay}
                  </td>
                  <td className="border-b px-5 py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
                    <span className={`pill pill-${deal.status}`}>
                      <span className="pill-dot" />
                      {STATUS_LABEL[deal.status] ?? deal.status}
                    </span>
                  </td>
                  <td className="border-b px-5 py-4 text-[13px]" style={{ color: "var(--ink-faint)", borderColor: "var(--glass-border-soft)" }}>
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
