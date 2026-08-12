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

const STATUS_CHIP: Record<string, string> = {
  processing: "chip-neutral chip-live",
  missing_info: "chip-warn",
  ready: "chip-active",
  sent: "chip-neutral",
  signed: "chip-success",
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
          <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Deals</h1>
          <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
            {deals.length} active — from first call to signed contract
          </div>
        </div>
        <div className="flex gap-2.5">
          <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Start on Google Meet
          </a>
          <a href="https://zoom.us/start/videomeeting" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Start on Zoom
          </a>
          <Link href="/deals/new" className="btn btn-primary">
            + Upload a call
          </Link>
        </div>
      </div>

      <div className="mb-3.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
        Connected to Zoom — new calls are picked up and analyzed automatically
        {workspace && (
          <span className="ml-2" style={{ color: "var(--ink-muted)" }}>
            · {workspace.callsUsedThisMonth} of {workspace.callsLimit} calls used this month
          </span>
        )}
      </div>

      <Link
        href="/deals/concept"
        className="btn btn-secondary btn-sm mb-5 inline-flex"
      >
        See how this looks next to a real Zoom call
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4l6 6-6 6" /></svg>
      </Link>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Client", "Value", "Status", "Updated"].map((h) => (
                  <th
                    key={h}
                    className="border-b px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wide"
                    style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="border-b px-5 py-4" style={{ borderColor: "var(--hairline-soft)" }}>
                    <Link href={`/deals/${deal.id}`} className="flex flex-col gap-0.5" style={{ color: "inherit" }}>
                      <span className="font-medium" style={{ color: "var(--ink)" }}>{deal.client.name}</span>
                      <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>{deal.service}</span>
                    </Link>
                  </td>
                  <td className="font-mono-tab border-b px-5 py-4 font-medium" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink)" }}>
                    {deal.feeDisplay}
                  </td>
                  <td className="border-b px-5 py-4" style={{ borderColor: "var(--hairline-soft)" }}>
                    <span className={`chip ${STATUS_CHIP[deal.status] ?? "chip-neutral"}`}>
                      <span className="chip-dot" />
                      {STATUS_LABEL[deal.status] ?? deal.status}
                    </span>
                  </td>
                  <td className="border-b px-5 py-4 text-[13px]" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline-soft)" }}>
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
