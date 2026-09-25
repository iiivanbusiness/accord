import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";
import { requireWorkspaceId } from "@/lib/workspace";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import GlassStatCard from "@/components/GlassStatCard";

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

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_LABEL: Record<string, string> = {
  processing: "Analyzing call",
  missing_info: "Missing info",
  extraction_failed: "Couldn't process call",
  ready: "Ready for review",
  pending_approval: "Awaiting approval",
  changes_requested: "Changes requested",
  sent: "Sent",
  signed: "Signed",
};

export default async function AnalyticsPage() {
  const workspaceId = await requireWorkspaceId();
  const { where: visibility, canViewAll } = await dealVisibilityFilter();
  const deals = await prisma.deal.findMany({
    where: { workspaceId, ...visibility },
    select: { status: true, feeDisplay: true, template: { select: { name: true } }, contract: { select: { sentAt: true, signedAt: true } } },
  });

  // Real count straight off the Call table (same visibility scope as
  // everything else on this page) rather than trusting Workspace.callsLimit's
  // running total — this is the number the call-limit removal left with
  // nowhere to live once the sidebar/Settings usage widgets came out.
  const calls = await prisma.call.findMany({ where: { deal: { workspaceId, ...visibility } }, select: { startedAt: true } });
  const totalCalls = calls.length;
  const now = new Date();
  const callsByMonth: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = calls.filter((c) => c.startedAt.getFullYear() === d.getFullYear() && c.startedAt.getMonth() === d.getMonth()).length;
    callsByMonth.push({ label: MONTH_LABEL[d.getMonth()], count });
  }
  const maxMonthlyCalls = Math.max(...callsByMonth.map((m) => m.count), 1);

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
    <>
    <div className="mb-6">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Analytics</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        How your deals are moving from call to signature{!canViewAll && ". Your own deals only"}
      </div>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
      <GlassStatCard label="Total calls" value={String(totalCalls)} sub="All time" />
      <GlassStatCard label="Active deals" value={String(total)} />
      <GlassStatCard label="Close rate" value={`${closeRate}%`} sub={`${signed} of ${total} signed`} />
      <GlassStatCard label="Combined deal value" value={`$${pipelineValue.toLocaleString()}`} sub="Across all active deals" />
      <GlassStatCard label="Avg. time to signature" value={avgSignDays === "—" ? avgSignDays : `${avgSignDays}d`} sub="From send to signed" />
    </div>

    <div className="mb-6 glass-card glass-card-solid card-hover">
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Calls by month</h2>
      </div>
      <div className="px-5 py-3">
        {callsByMonth.map((m) => (
          <BarRow key={m.label} label={m.label} count={m.count} max={maxMonthlyCalls} />
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
      <div className="glass-card glass-card-solid card-hover">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Deals by status</h2>
        </div>
        <div className="px-5 py-3">
          {[...statusCounts.entries()].map(([status, count]) => (
            <BarRow key={status} label={STATUS_LABEL[status] ?? status} count={count} max={maxStatusCount} />
          ))}
        </div>
      </div>

      <div className="glass-card glass-card-solid card-hover">
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
    </>
  );
}
