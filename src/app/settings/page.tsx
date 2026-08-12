import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

export default async function SettingsPage() {
  const workspace = await prisma.workspace.findFirst();
  const usagePct = workspace ? Math.round((workspace.callsUsedThisMonth / workspace.callsLimit) * 100) : 0;

  return (
    <AppShell active="/settings" screenLabel="Settings">
      <div className="mb-6">
        <h1 className="text-[25px] font-bold">Settings</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Workspace preferences for {workspace?.name ?? "your workspace"}
        </div>
      </div>

      <div className="glass mb-4 max-w-[600px] rounded-[20px]">
        <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--glass-border-soft)" }}>
          <h2 className="text-[15px] font-bold">Call integrations</h2>
        </div>
        <div className="px-[22px] py-2">
          <div className="flex items-center justify-between gap-3.5 border-b py-3.5" style={{ borderColor: "var(--glass-border-soft)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border font-display text-[14px] font-bold" style={{ background: "rgba(74,144,226,.18)", color: "#8FB8F0", borderColor: "var(--glass-border)" }}>Z</div>
              <div>
                <div className="text-[13.5px] font-semibold">Zoom</div>
                <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>Real-time call analysis via Zoom RTMS</div>
              </div>
            </div>
            <span className="rounded-full px-[13px] py-[7px] text-[12.5px] font-semibold" style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-strong))", color: "var(--accent-ink)" }}>Connected ✓</span>
          </div>
          <div className="flex items-center justify-between gap-3.5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border font-display text-[14px] font-bold" style={{ background: "rgba(52,168,83,.18)", color: "#7FDB9A", borderColor: "var(--glass-border)" }}>G</div>
              <div>
                <div className="text-[13.5px] font-semibold">Google Meet</div>
                <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>Not prioritized yet — upload calls manually for now</div>
              </div>
            </div>
            <button className="rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold" style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}>Connect</button>
          </div>
        </div>
      </div>

      <div className="glass max-w-[600px] rounded-[20px] px-[22px] py-2">
        <div className="flex items-center justify-between gap-4 border-b py-[15px]" style={{ borderColor: "var(--glass-border-soft)" }}>
          <div>
            <div className="text-[13.5px] font-semibold">Plan</div>
            <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
              {workspace?.plan} — {workspace?.callsUsedThisMonth} of {workspace?.callsLimit} calls used this month
            </div>
            <div className="mt-2 h-2 w-[220px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-strong))" }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-[15px]">
          <div>
            <div className="text-[13.5px] font-semibold">Require manual approval before sending</div>
            <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>Nothing reaches a client without your review</div>
          </div>
          <div className="h-6 w-10 flex-none rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid rgba(79,227,190,.4)" }} />
        </div>
      </div>
    </AppShell>
  );
}
