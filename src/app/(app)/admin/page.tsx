import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { applyPlanChange, dismissUpgradeRequest, setProspectingEnabled } from "./actions";

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

// The admin tables have to fit beside the sidebar at any window width,
// not just full screen: lower-priority columns drop out as the window
// narrows instead of pushing the Prospecting switch off the edge.
const COLUMN_SHOW = {
  owner: "hidden lg:table-cell",
  plan: "hidden xl:table-cell",
  calls: "hidden md:table-cell",
  deals: "hidden lg:table-cell",
  signedUp: "hidden 2xl:table-cell",
  lastActivity: "hidden xl:table-cell",
};

const WORKSPACE_COLUMNS = [
  { label: "Workspace", show: "" },
  { label: "Owner", show: COLUMN_SHOW.owner },
  { label: "Plan", show: COLUMN_SHOW.plan },
  { label: "Calls used", show: COLUMN_SHOW.calls },
  { label: "Deals", show: COLUMN_SHOW.deals },
  { label: "Signed up", show: COLUMN_SHOW.signedUp },
  { label: "Last activity", show: COLUMN_SHOW.lastActivity },
  { label: "Prospecting", show: "" },
];

const PROFILE_SHOW = {
  role: "hidden lg:table-cell",
  calls: "hidden xl:table-cell",
  handoff: "hidden xl:table-cell",
  signedUp: "hidden md:table-cell",
};

const PROFILE_COLUMNS = [
  { label: "Workspace", show: "" },
  { label: "Role", show: PROFILE_SHOW.role },
  { label: "Calls / month", show: PROFILE_SHOW.calls },
  { label: 'After a "yes"', show: PROFILE_SHOW.handoff },
  { label: "Biggest problem", show: "" },
  { label: "Signed up", show: PROFILE_SHOW.signedUp },
];

const AUDIT_SHOW = {
  workspace: "hidden xl:table-cell",
  actor: "hidden lg:table-cell",
  details: "hidden lg:table-cell",
};

const AUDIT_COLUMNS = [
  { label: "When", show: "" },
  { label: "Workspace", show: AUDIT_SHOW.workspace },
  { label: "Actor", show: AUDIT_SHOW.actor },
  { label: "Event", show: "" },
  { label: "Details", show: AUDIT_SHOW.details },
];

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "login.success": "Signed in",
  "login.failure": "Failed sign-in",
  "login.rate_limited": "Sign-in rate-limited",
  "workspace.created": "Workspace created",
  "password.reset": "Password reset",
  "contract.sent": "Contract sent",
  "contract.signed": "Contract signed",
  "teammate.invited": "Teammate invited",
  "teammate.removed": "Teammate removed",
  "admin.plan_changed": "Plan changed",
  "admin.prospecting_enabled": "Prospecting turned on",
  "admin.prospecting_disabled": "Prospecting turned off",
};

const AUDIT_ACTION_CHIP: Record<string, string> = {
  "login.failure": "chip-warn",
  "login.rate_limited": "chip-warn",
  "contract.signed": "chip-success",
  "workspace.created": "chip-success",
};

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

  const [workspaces, pendingRequests, onboardingProfiles, auditLogs] = await Promise.all([
    prisma.workspace.findMany({
      include: { users: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.upgradeRequest.findMany({
      where: { status: "pending" },
      include: { workspace: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.onboardingProfile.findMany({
      include: { workspace: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      include: { workspace: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const activity = await Promise.all(
    workspaces.map((w) =>
      prisma.deal.aggregate({ where: { workspaceId: w.id }, _max: { updatedAt: true }, _count: true })
    )
  );

  const totalUsers = workspaces.reduce((sum, w) => sum + w.users.length, 0);
  const totalDeals = activity.reduce((sum, a) => sum + a._count, 0);
  const totalCallsUsed = workspaces.reduce((sum, w) => sum + w.callsUsedThisMonth, 0);

  return (
    <>
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
                  Requested {timeAgo(req.createdAt)}. Currently {req.workspace.plan}, {req.workspace.callsUsedThisMonth} of {req.workspace.callsLimit} calls
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

    {onboardingProfiles.length > 0 && (
      <div className="card mb-6 overflow-hidden">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Client profiles</h2>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            Onboarding answers. Raw material for figuring out who your ideal customer actually is
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {PROFILE_COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className={`whitespace-nowrap border-b px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wide ${col.show}`}
                    style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {onboardingProfiles.map((p) => (
                <tr key={p.id} className="row-hover transition-colors">
                  <td className="border-b px-4 py-3.5 font-medium" style={{ borderColor: "var(--hairline-soft)" }}>
                    <div className="max-w-[160px] truncate" title={p.workspace.name}>{p.workspace.name}</div>
                  </td>
                  <td className={`border-b px-4 py-3.5 text-[13px] ${PROFILE_SHOW.role}`} style={{ borderColor: "var(--hairline-soft)" }}>{p.role}</td>
                  <td className={`border-b px-4 py-3.5 text-[13px] ${PROFILE_SHOW.calls}`} style={{ borderColor: "var(--hairline-soft)" }}>{p.callVolume}</td>
                  <td className={`border-b px-4 py-3.5 text-[13px] ${PROFILE_SHOW.handoff}`} style={{ borderColor: "var(--hairline-soft)" }}>{p.handoff}</td>
                  <td className="border-b px-4 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)" }}>{p.biggestProblem}</td>
                  <td className={`whitespace-nowrap border-b px-4 py-3.5 text-[13px] ${PROFILE_SHOW.signedUp}`} style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                    {timeAgo(p.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {WORKSPACE_COLUMNS.map((col) => (
                <th
                  key={col.label}
                  className={`whitespace-nowrap border-b px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wide ${col.show}`}
                  style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w, i) => {
              const stats = activity[i];
              const cell = "border-b px-4 py-3.5 text-[13px]";
              const border = { borderColor: "var(--hairline-soft)" };
              const muted = { ...border, color: "var(--ink-muted)" };
              return (
                <tr key={w.id} className="row-hover transition-colors">
                  <td className="border-b px-4 py-3.5 font-medium" style={border}>
                    <div className="max-w-[160px] truncate" title={w.name}>{w.name}</div>
                  </td>
                  <td className={`${cell} ${COLUMN_SHOW.owner}`} style={muted}>
                    <div className="max-w-[180px] truncate" title={w.users[0]?.email}>{w.users[0]?.email ?? "-"}</div>
                  </td>
                  <td className={`${cell} ${COLUMN_SHOW.plan}`} style={border}>{w.plan}</td>
                  <td className={`font-mono-tab whitespace-nowrap ${cell} ${COLUMN_SHOW.calls}`} style={border}>
                    {w.callsUsedThisMonth} / {w.callsLimit}
                  </td>
                  <td className={`font-mono-tab ${cell} ${COLUMN_SHOW.deals}`} style={border}>{stats._count}</td>
                  <td className={`whitespace-nowrap ${cell} ${COLUMN_SHOW.signedUp}`} style={muted}>
                    {w.createdAt.toLocaleDateString()}
                  </td>
                  <td className={`whitespace-nowrap ${cell} ${COLUMN_SHOW.lastActivity}`} style={muted}>
                    {stats._max.updatedAt ? timeAgo(stats._max.updatedAt) : "-"}
                  </td>
                  <td className={cell} style={border}>
                    <form action={setProspectingEnabled.bind(null, w.id, !w.prospectingEnabled)}>
                      <button
                        type="submit"
                        className={`chip ${w.prospectingEnabled ? "chip-success" : "chip-neutral"}`}
                        title={w.prospectingEnabled ? "Turn off Leads, tasks, and calls for this workspace" : "Turn on Leads, tasks, and calls for this workspace"}
                      >
                        {w.prospectingEnabled ? "On" : "Off"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {auditLogs.length > 0 && (
      <div className="card mt-6 overflow-hidden">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Recent activity</h2>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            Security-relevant events across every workspace. Last 100
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {AUDIT_COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className={`whitespace-nowrap border-b px-3 py-3 text-left text-[12px] font-medium uppercase tracking-wide ${col.show}`}
                    style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => {
                let details = "";
                if (entry.metadata) {
                  try {
                    const parsed = JSON.parse(entry.metadata) as Record<string, unknown>;
                    details = Object.entries(parsed)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");
                  } catch {
                    // ignore malformed metadata
                  }
                }
                return (
                  <tr key={entry.id} className="row-hover transition-colors">
                    <td className="whitespace-nowrap border-b px-3 py-3.5 text-[13px]" style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      {timeAgo(entry.createdAt)}
                    </td>
                    <td className={`border-b px-3 py-3.5 text-[13px] font-medium ${AUDIT_SHOW.workspace}`} style={{ borderColor: "var(--hairline-soft)" }}>
                      <div className="max-w-[140px] truncate" title={entry.workspace?.name}>{entry.workspace?.name ?? "-"}</div>
                    </td>
                    <td className={`border-b px-3 py-3.5 text-[13px] ${AUDIT_SHOW.actor}`} style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      <div className="max-w-[170px] truncate" title={entry.actorEmail ?? undefined}>{entry.actorEmail ?? "-"}</div>
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
                      <span className={`chip ${AUDIT_ACTION_CHIP[entry.action] ?? "chip-neutral"}`}>
                        <span className="chip-dot" />
                        {AUDIT_ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className={`min-w-[140px] border-b px-3 py-3.5 text-[12.5px] [overflow-wrap:anywhere] ${AUDIT_SHOW.details}`} style={{ borderColor: "var(--hairline-soft)", color: "var(--ink-muted)" }}>
                      {details}
                      {entry.ip ? ` · ${entry.ip}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  );
}
