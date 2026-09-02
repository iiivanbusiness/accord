import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireWorkspaceId } from "@/lib/workspace";
import { getSenderDomainStatus, type SenderDomainRecord } from "@/lib/sender-domain";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import RolesManager from "@/components/RolesManager";
import RoleSelect from "@/components/RoleSelect";
import ApprovalChainManager from "@/components/ApprovalChainManager";
import {
  checkSenderDomainVerification,
  connectSenderDomain,
  disconnectSenderDomain,
  inviteTeammate,
  removeLogo,
  removeTeammate,
  requestUpgrade,
  toggleWorkspaceFlag,
  updateWorkspaceName,
  uploadLogo,
} from "./actions";
import { assignUserRole, createRole, deleteRole, updateRole } from "./roles-actions";
import { addApprovalStep, moveApprovalStep, removeApprovalStep } from "./approval-actions";

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
  const workspaceId = await requireWorkspaceId();
  const [workspace, session, roles, approvalSteps] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, include: { users: { include: { role: true } } } }),
    auth(),
    prisma.role.findMany({ where: { workspaceId }, include: { _count: { select: { users: true } } }, orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }] }),
    prisma.approvalStep.findMany({ where: { workspaceId }, include: { role: true }, orderBy: { order: "asc" } }),
  ]);
  const usagePct = workspace ? Math.round((workspace.callsUsedThisMonth / workspace.callsLimit) * 100) : 0;
  if (!workspace) return null;
  const currentUser = workspace.users.find((u) => u.email === session?.user?.email);
  const canManageTeam = Boolean(currentUser?.role?.canManageTeam);
  const canManageWorkspacePerm = Boolean(currentUser?.role?.canManageWorkspace);
  const notifyEmail = workspace.users.map((u) => u.email).join(", ") || "your account email";
  const pendingUpgrade = await prisma.upgradeRequest.findFirst({ where: { workspaceId, status: "pending" } });
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));
  const eligibleApproverRoles = roles.filter((r) => r.canApproveContracts).map((r) => ({ id: r.id, name: r.name }));

  let senderRecords: SenderDomainRecord[] = [];
  if (workspace.senderDomainId && workspace.senderDomainStatus !== "verified") {
    try {
      const live = await getSenderDomainStatus(workspace.senderDomainId);
      senderRecords = live.records;
    } catch {
      // Resend lookup failed — fall back to showing the last known status below
    }
  }

  return (
    <>
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
      <div className="flex items-center justify-between gap-4 py-[15px]">
        <div className="w-full">
          <div className="text-[13.5px] font-medium">Workspace name</div>
          <form action={updateWorkspaceName} className="mt-2 flex gap-2">
            <input name="name" defaultValue={workspace.name} className="input flex-1" style={{ fontSize: "13px", padding: "8px 11px" }} />
            <button type="submit" className="btn btn-secondary btn-sm">Save</button>
          </form>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t py-[15px]" style={{ borderColor: "var(--hairline-soft)" }}>
        <div className="w-full">
          <div className="text-[13.5px] font-medium">Logo</div>
          <div className="mb-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Shown to clients on the sign page and the contract PDF instead of just your name.
          </div>
          {workspace.logoImage && (
            <div className="mb-2.5 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={workspace.logoImage} alt="Workspace logo" style={{ height: 36, maxWidth: 160, objectFit: "contain" }} />
              <form action={removeLogo}>
                <button type="submit" className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                  Remove
                </button>
              </form>
            </div>
          )}
          <form action={uploadLogo} className="flex gap-2">
            <input name="logo" type="file" accept="image/*" required className="input flex-1" style={{ fontSize: "13px", padding: "7px 11px" }} />
            <button type="submit" className="btn btn-secondary btn-sm">{workspace.logoImage ? "Replace" : "Upload"}</button>
          </form>
        </div>
      </div>
    </div>

    <div className="card mb-4 max-w-[600px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Team</h2>
      </div>
      <div className="px-[22px] py-2">
        {workspace.users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3.5 border-b py-3" style={{ borderColor: "var(--hairline-soft)" }}>
            <div>
              <div className="text-[13.5px] font-medium">{u.name}</div>
              <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{u.email}</div>
            </div>
            <div className="flex items-center gap-3">
              {canManageTeam && roleOptions.length > 0 ? (
                <RoleSelect userId={u.id} currentRoleId={u.roleId} roles={roleOptions} action={assignUserRole} />
              ) : (
                u.role && <span className="chip chip-neutral" style={{ fontSize: 11 }}>{u.role.name}</span>
              )}
              {workspace.users.length > 1 && canManageTeam && (
                <form action={removeTeammate.bind(null, u.id)}>
                  <button type="submit" className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
                    Remove
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        <form action={inviteTeammate} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center">
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@company.com"
            className="input flex-1"
            style={{ fontSize: "13px", padding: "8px 11px" }}
          />
          <button type="submit" className="btn btn-secondary btn-sm">Invite</button>
        </form>
        <div className="pb-3 text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
          They&apos;ll get an email — they need to sign in with Google using that address (no password yet for invited teammates).
        </div>
      </div>
    </div>

    {canManageTeam && (
      <div className="card mb-4 max-w-[600px]">
        <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Roles &amp; permissions</h2>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Owner always has every permission. Custom roles control what teammates can do — and can later gate steps in a contract approval chain.
          </div>
        </div>
        <RolesManager
          roles={roles.map((r) => ({
            id: r.id,
            name: r.name,
            isOwner: r.isOwner,
            canManageWorkspace: r.canManageWorkspace,
            canManageTeam: r.canManageTeam,
            canManageTemplates: r.canManageTemplates,
            canApproveContracts: r.canApproveContracts,
            canApproveTemplates: r.canApproveTemplates,
            canViewAllDeals: r.canViewAllDeals,
            memberCount: r._count.users,
          }))}
          createRoleAction={createRole}
          updateRoleAction={updateRole}
          deleteRoleAction={deleteRole}
        />
      </div>
    )}

    {canManageWorkspacePerm && (
      <div className="card mb-4 max-w-[600px]">
        <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Approval chain</h2>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Contracts wait for every role below to approve, in order, before they go out to the client.
          </div>
        </div>
        <ApprovalChainManager
          steps={approvalSteps.map((s) => ({ id: s.id, order: s.order, roleId: s.roleId, roleName: s.role.name }))}
          eligibleRoles={eligibleApproverRoles}
          addStepAction={addApprovalStep}
          removeStepAction={removeApprovalStep}
          moveStepAction={moveApprovalStep}
        />
      </div>
    )}

    {currentUser?.passwordHash && (
      <div className="card mb-4 max-w-[600px]">
        <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="text-[15px] font-medium">Two-factor authentication</h2>
        </div>
        <div className="px-[22px] py-4">
          <TwoFactorSettings enabled={currentUser.twoFactorEnabled} />
        </div>
      </div>
    )}

    <div className="card mb-4 max-w-[600px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Plan &amp; usage</h2>
      </div>
      <div className="px-[22px] py-[18px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[13.5px] font-medium">{workspace.plan}</div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {workspace.callsUsedThisMonth} of {workspace.callsLimit} calls used this month
            </div>
          </div>
          <span className="chip chip-neutral">{usagePct}%</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, usagePct)}%`, background: usagePct >= 100 ? "#ff6b57" : "var(--primary)" }} />
        </div>

        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--hairline-soft)" }}>
          {pendingUpgrade ? (
            <div className="chip chip-warn w-full justify-start px-3.5 py-2.5 text-[12.5px]">
              Upgrade requested — we&apos;ll be in touch soon.
            </div>
          ) : (
            <form action={requestUpgrade} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                name="note"
                placeholder="What do you need? (optional)"
                className="input flex-1"
                style={{ fontSize: "13px", padding: "8px 11px" }}
              />
              <button type="submit" className="btn btn-primary btn-sm">Request upgrade</button>
            </form>
          )}
        </div>
      </div>
    </div>

    <div className="card mb-4 max-w-[600px]">
      <div className="border-b px-[22px] py-4" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="text-[15px] font-medium">Sending domain</h2>
      </div>
      <div className="px-[22px] py-[18px]">
        {!workspace.senderDomain ? (
          <>
            <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              Verify your own domain so contracts go out as you, not &ldquo;via SealMe&rdquo;.
            </p>
            <form action={connectSenderDomain} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                name="mailbox"
                defaultValue="hello"
                placeholder="hello"
                className="input"
                style={{ fontSize: "13px", padding: "8px 11px", width: 110 }}
              />
              <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>@</span>
              <input
                name="domain"
                required
                placeholder="yourcompany.com"
                className="input flex-1"
                style={{ fontSize: "13px", padding: "8px 11px" }}
              />
              <button type="submit" className="btn btn-primary btn-sm">Connect</button>
            </form>
          </>
        ) : workspace.senderDomainStatus === "verified" ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="chip chip-success">Verified ✓</div>
              <div className="mt-2 text-[13px] font-medium">{workspace.senderEmail}</div>
              <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Contracts are sent from this address.</div>
            </div>
            <form action={disconnectSenderDomain}>
              <button type="submit" className="btn btn-secondary btn-sm">Change</button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-[13.5px] font-medium">{workspace.senderDomain}</div>
                <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                  Add these DNS records at your domain host, then check verification.
                </div>
              </div>
            </div>
            {senderRecords.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-[10px]" style={{ border: "1px solid var(--hairline)" }}>
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {["Type", "Name", "Value", "Status"].map((h) => (
                        <th key={h} className="border-b px-3 py-2 text-left font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)", borderColor: "var(--hairline)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {senderRecords.map((rec, i) => (
                      <tr key={i}>
                        <td className="font-mono-tab border-b px-3 py-2" style={{ borderColor: "var(--hairline-soft)" }}>{rec.type}</td>
                        <td className="font-mono-tab border-b px-3 py-2 break-all" style={{ borderColor: "var(--hairline-soft)" }}>{rec.name}</td>
                        <td className="font-mono-tab border-b px-3 py-2 break-all" style={{ borderColor: "var(--hairline-soft)" }}>{rec.value}</td>
                        <td className="border-b px-3 py-2" style={{ borderColor: "var(--hairline-soft)" }}>
                          <span className={`chip ${rec.status === "verified" ? "chip-success" : "chip-neutral"}`} style={{ fontSize: 11 }}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <form action={checkSenderDomainVerification}>
                <button type="submit" className="btn btn-primary btn-sm">Check verification</button>
              </form>
              <form action={disconnectSenderDomain}>
                <button type="submit" className="btn btn-secondary btn-sm">Start over</button>
              </form>
            </div>
          </>
        )}
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
    </>
  );
}
