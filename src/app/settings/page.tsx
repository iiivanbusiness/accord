import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

export default async function SettingsPage() {
  const workspace = await prisma.workspace.findFirst();
  const usagePct = workspace ? Math.round((workspace.callsUsedThisMonth / workspace.callsLimit) * 100) : 0;

  return (
    <AppShell active="/settings" screenLabel="Settings">
      <div className="mb-6">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Settings</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          Workspace preferences for {workspace?.name ?? "your workspace"}
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
            <span className="chip chip-success">Connected ✓</span>
          </div>
          <div className="flex items-center justify-between gap-3.5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[14px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>G</div>
              <div>
                <div className="text-[13.5px] font-medium">Google Meet</div>
                <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Not prioritized yet — upload calls manually for now</div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm">Connect</button>
          </div>
        </div>
      </div>

      <div className="card max-w-[600px] px-[22px] py-2">
        <div className="flex items-center justify-between gap-4 border-b py-[15px]" style={{ borderColor: "var(--hairline-soft)" }}>
          <div>
            <div className="text-[13.5px] font-medium">Plan</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {workspace?.plan} — {workspace?.callsUsedThisMonth} of {workspace?.callsLimit} calls used this month
            </div>
            <div className="mt-2 h-2 w-[220px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: "var(--primary)" }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-[15px]">
          <div>
            <div className="text-[13.5px] font-medium">Require manual approval before sending</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Nothing reaches a client without your review</div>
          </div>
          <div className="h-6 w-10 flex-none rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
            <div className="h-[18px] w-[18px] translate-x-[18px] translate-y-[2px] rounded-full" style={{ background: "var(--primary)" }} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
