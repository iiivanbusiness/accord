import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

function parseFee(feeDisplay: string): number {
  const match = feeDisplay.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
      <div className="font-mono-tab mt-2 text-[28px] font-medium">{value}</div>
      {sub && (
        <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-[150px] flex-none truncate text-[13px]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
      </div>
      <span className="font-mono-tab w-[24px] flex-none text-right text-[13px] font-medium">{count}</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call",
  missing_info: "Missing info",
  ready: "Ready for review",
  sent: "Sent",
  signed: "Signed",
};

export default async function AnalyticsPage() {
  const deals = await prisma.deal.findMany({ include: { template: true, contract: true } });

  const total = deals.length;
  const signed = deals.filter((d) => d.status === "signed").length;
  const closeRate = total > 0 ? Math.round((signed / total) * 100) : 0;
  const pipelineValue = deals.reduce((sum, d) => sum + parseFee(d.feeDisplay), 0);

  const signTimes = deals
    .map((d) => d.contract)
    .filter((c) => c && c.sentAt && c.signedAt)
    .map((c) => (c!.signedAt!.getTime() - c!.sentAt!.getTime()) / 86400000);
  const avgSignDays = signTimes.length > 0 ? (signTimes.reduce((a, b) => a + b, 0) / signTimes.length).toFixed(1) : "—";

  const statusCounts = new Map<string, number>();
  for (const d of deals) statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
  const maxStatusCount = Math.max(...statusCounts.values(), 1);

  const templateCounts = new Map<string, number>();
  for (const d of deals) {
    const name = d.template?.name ?? "No template";
    templateCounts.set(name, (templateCounts.get(name) ?? 0) + 1);
  }
  const maxTemplateCount = Math.max(...templateCounts.values(), 1);

  return (
    <AppShell active="/analytics" screenLabel="Analytics">
      <div className="mb-6">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Analytics</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          How your deals are moving from call to signature
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active deals" value={String(total)} />
        <StatCard label="Close rate" value={`${closeRate}%`} sub={`${signed} of ${total} signed`} />
        <StatCard label="Combined deal value" value={`€${pipelineValue.toLocaleString()}`} sub="Across all active deals" />
        <StatCard label="Avg. time to signature" value={avgSignDays === "—" ? avgSignDays : `${avgSignDays}d`} sub="From send to signed" />
      </div>

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
            <h2 className="text-[15px] font-medium">Deals by status</h2>
          </div>
          <div className="px-5 py-3">
            {[...statusCounts.entries()].map(([status, count]) => (
              <BarRow key={status} label={STATUS_LABEL[status] ?? status} count={count} max={maxStatusCount} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
            <h2 className="text-[15px] font-medium">Template usage</h2>
          </div>
          <div className="px-5 py-3">
            {[...templateCounts.entries()].map(([name, count]) => (
              <BarRow key={name} label={name} count={count} max={maxTemplateCount} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
