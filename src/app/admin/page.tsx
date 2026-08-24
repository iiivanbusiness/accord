import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { applyPlanChange, dismissUpgradeRequest } from "./actions";

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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
      <div className="font-mono-tab mt-2 text-[26px] font-medium">{value}</div>
    </div>
  );
}

export default async function AdminPage() {
  await requireAdmin();

  const workspaces = await prisma.workspace.findMany({
    include: { users: true },
    orderBy: { createdAt: "desc" },
  });

  const activity = await Promise.all(
    workspaces.map((w) =>
      prisma.deal.aggregate({ where: { workspaceId: w.id }, _max: { updatedAt: true }, _count: true })
    )
  );

  const pendingRequests = await prisma.upgradeRequest.findMany({
    where: { status: "pending" },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
  });

  const totalUsers = workspaces.reduce((sum, w) => sum + w.users.length, 0);
  const totalDeals = activity.reduce((sum, a) => sum + a._count, 0);
  const totalCallsUsed = workspaces.reduce((sum, w) => sum + w.callsUsedThisMonth, 0);

  return (
    <AppShell active="/admin" screenLabel="Admin">
      <div className="mb-6">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Admin</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          Platform-wide view across every workspace
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Workspaces" value={String(workspaces.length)} />
        <StatCard label="Signed-up users" value={String(totalUsers)} />
        <StatCard label="Deals platform-wide" value={String(totalDeals)} />
        <StatCard label="Calls used this month" value={String(totalCallsUsed)} />
      </div>

      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2.5 text-[15px] font-medium">Upgrade requests</h2>
          <div className="flex flex-col gap-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="card flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{req.workspace.name}</div>
                  {req.note && (
                    <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                      &ldquo;{req.note}&rdquo;
                    </div>
                  )}
                  <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                    Requested {timeAgo(req.createdAt)} — currently {req.workspace.plan}, {req.workspace.callsUsedThisMonth} of {req.workspace.callsLimit} calls
                  </div>
                </div>
                <form action={applyPlanChange.bind(null, req.workspaceId, req.id)} className="flex flex-none flex-wrap items-center gap-2">
                  <input name="plan" defaultValue={req.workspace.plan} className="input" style={{ width: 110, fontSize: 13, padding: "7px 10px" }} />
                  <input name="callsLimit" type="number" min={1} defaultValue={req.workspace.callsLimit} className="input" style={{ width: 80, fontSize: 13, padding: "7px 10px" }} />
                  <button type="submit" className="btn btn-primary btn-sm">Apply</button>
                </form>
                <form action={dismissUpgradeRequest.bind(null, req.id)}>
                  <button type="submit" className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                    Dismiss
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Workspaces</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Workspace", "Owner", "Plan", "Calls used", "Deals", "Signed up", "Last activity"].map((h) => (
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
              {workspaces.map((w, i) => {
                const stats = activity[i];
                return (
                  <tr key={w.id} className="row-hover transition-colors">
                    <td className="border-b px-5 py-3.5 font-medium" style={{ borderColor: "var(--hairline-soft)" }}>{w.name}</td>
                    <td className="border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      {w.users[0]?.email ?? "—"}
                    </td>
                    <td className="border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>{w.plan}</td>
                    <td className="font-mono-tab border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>
                      {w.callsUsedThisMonth} / {w.callsLimit}
                    </td>
                    <td className="font-mono-tab border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>{stats._count}</td>
                    <td className="border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      {w.createdAt.toLocaleDateString()}
                    </td>
                    <td className="border-b px-5 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      {stats._max.updatedAt ? timeAgo(stats._max.updatedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
