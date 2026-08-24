import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { toggleWorkspaceFlag, updateWorkspaceName } from "./actions";

function Toggle({ on, field }: { on: boolean; field: "requireApproval" | "notifyOnSigned" | "autoRemind" }) {
  return (
    <form action={toggleWorkspaceFlag.bind(null, field)}>
      <button
        type="submit"
        className="h-6 w-10 flex-none rounded-full"
        style={{ background: on ? "var(--surface-2)" : "var(--canvas)", border: "1px solid var(--hairline)" }}
      >
        <div
          className="h-[18px] w-[18px] rounded-full transition-transform"
          style={{ background: on ? "var(--primary)" : "var(--ink-muted)", transform: on ? "translate(19px, 2px)" : "translate(2px, 2px)" }}
        />
      </button>
    </form>
  );
}

export default async function SettingsPage() {
  const workspace = await prisma.workspace.findFirst({ include: { users: true } });
  const usagePct = workspace ? Math.round((workspace.callsUsedThisMonth / workspace.callsLimit) * 100) : 0;
  if (!workspace) return null;
  const notifyEmail = workspace.users[0]?.email ?? "your account email";

  return (
    <AppShell active="/settings" screenLabel="Settings">
      <div className="mb-6">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Settings</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          Workspace preferences for {workspace.name}
        </div>
      </div>

      <div className="card mb-4 max-w-[600px]">
        <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Call integrations</h2>
        </div>
        <div className="px-[22px] py-2">
          <div className="flex items-center justify-between gap-3.5 border-b py-3.5" style={{ borderColor: "var(--hairline-soft)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[14px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>Z</div>
              <div>
                <div className="text-[13.5px] font-medium">Zoom</div>
                <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Real-time call analysis via Zoom RTMS</div>
              </div>
            </div>
            <form action={toggleWorkspaceFlag.bind(null, "zoomConnected")}>
              <button type="submit" className={workspace.zoomConnected ? "chip chip-success" : "btn btn-secondary btn-sm"}>
                {workspace.zoomConnected ? "Connected ✓" : "Connect"}
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3.5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[14px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>G</div>
              <div>
                <div className="text-[13.5px] font-medium">Google Meet</div>
                <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Not prioritized yet — upload calls manually for now</div>
              </div>
            </div>
            <form action={toggleWorkspaceFlag.bind(null, "meetConnected")}>
              <button type="submit" className={workspace.meetConnected ? "chip chip-success" : "btn btn-secondary btn-sm"}>
                {workspace.meetConnected ? "Connected ✓" : "Connect"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card mb-4 max-w-[600px] px-[22px] py-2">
        <div className="flex items-center justify-between gap-4 border-b py-[15px]" style={{ borderColor: "var(--hairline-soft)" }}>
          <div className="w-full">
            <div className="text-[13.5px] font-medium">Workspace name</div>
            <form action={updateWorkspaceName} className="mt-2 flex gap-2">
              <input name="name" defaultValue={workspace.name} className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} />
              <button type="submit" className="btn btn-secondary btn-sm">Save</button>
            </form>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-[15px]">
          <div>
            <div className="text-[13.5px] font-medium">Plan</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {workspace.plan} — {workspace.callsUsedThisMonth} of {workspace.callsLimit} calls used this month
            </div>
            <div className="mt-2 h-2 w-[220px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: "var(--primary)" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card max-w-[600px] px-[22px] py-2">
        <div className="flex items-center justify-between gap-4 border-b py-[15px]" style={{ borderColor: "var(--hairline-soft)" }}>
          <div>
            <div className="text-[13.5px] font-medium">Require manual approval before sending</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Nothing reaches a client without your review</div>
          </div>
          <Toggle on={workspace.requireApproval} field="requireApproval" />
        </div>
        <div className="flex items-center justify-between gap-4 border-b py-[15px]" style={{ borderColor: "var(--hairline-soft)" }}>
          <div>
            <div className="text-[13.5px] font-medium">Email me when a contract is signed</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Sent to {notifyEmail}</div>
          </div>
          <Toggle on={workspace.notifyOnSigned} field="notifyOnSigned" />
        </div>
        <div className="flex items-center justify-between gap-4 py-[15px]">
          <div>
            <div className="text-[13.5px] font-medium">Auto-remind clients after 3 days</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>One polite nudge if a contract is left unsigned</div>
          </div>
          <Toggle on={workspace.autoRemind} field="autoRemind" />
        </div>
      </div>
    </AppShell>
  );
}
