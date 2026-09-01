import { prisma } from "@/lib/db";
import { sendContractEmail, sendApprovalRequestedEmail, sendChangesRequestedEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { getOrMintPortalToken } from "@/lib/client-portal";

export type PendingEmail = { to: string; subject: string; message: string };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

// Called anywhere a contract is about to leave the workspace's control —
// the manual Send page and the "no approval needed" auto-send path both
// go through here. If the workspace has an approval chain configured, the
// contract is held in "pending_approval" and the composed email is stored
// verbatim until the chain finishes; otherwise it's sent immediately,
// exactly like before this feature existed.
export async function requestOrSendContract(
  dealId: string,
  pending: PendingEmail,
  actorEmail?: string | null
): Promise<"sent" | "pending_approval"> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { contract: true } });
  if (!deal || !deal.contract) throw new Error("Deal not found");
  const contractId = deal.contract.id;

  const steps = await prisma.approvalStep.findMany({
    where: { workspaceId: deal.workspaceId },
    orderBy: { order: "asc" },
  });

  if (steps.length === 0) {
    await performActualSend(contractId, pending);
    await logAudit({ workspaceId: deal.workspaceId, actorEmail, action: "contract.sent", targetType: "Deal", targetId: dealId, metadata: { to: pending.to } });
    return "sent";
  }

  // A contract re-entering approval after a rejection gets a fresh
  // snapshot — always mirrors the chain as currently configured, never a
  // stale one left over from a previous round.
  await prisma.contractApproval.deleteMany({ where: { contractId } });
  await prisma.contractApproval.createMany({
    data: steps.map((s) => ({ contractId, roleId: s.roleId, order: s.order, status: "pending" })),
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "pending_approval",
      pendingTo: pending.to,
      pendingSubject: pending.subject,
      pendingMessage: pending.message,
    },
  });
  await prisma.deal.update({ where: { id: dealId }, data: { status: "pending_approval" } });

  await logAudit({ workspaceId: deal.workspaceId, actorEmail, action: "contract.approval_requested", targetType: "Deal", targetId: dealId });

  await notifyStepApprovers(dealId, steps[0].roleId);

  return "pending_approval";
}

// Actually emails the client — either right away (no chain configured) or
// once the last approval step has signed off. pendingOverride lets the
// immediate-send path skip a DB round-trip; the approval path relies on
// what's already stored on the contract.
export async function performActualSend(contractId: string, pendingOverride?: PendingEmail): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { deal: { include: { client: true, workspace: { include: { users: true } } } } },
  });
  if (!contract) throw new Error("Contract not found");

  const to = pendingOverride?.to ?? contract.pendingTo;
  const subject = pendingOverride?.subject ?? contract.pendingSubject;
  const message = pendingOverride?.message ?? contract.pendingMessage;
  if (!to || !subject || !message) throw new Error("Missing email content to send");

  const { deal } = contract;
  const { workspace } = deal;
  const signLink = `${appUrl()}/sign/${contract.id}`;
  const replyTo = workspace.users[0]?.email ?? null;
  const verifiedSenderEmail = workspace.senderDomainStatus === "verified" ? workspace.senderEmail : null;

  const portalToken = await getOrMintPortalToken(deal.client.id);
  const portalUrl = `${appUrl()}/portal/${portalToken}`;

  await sendContractEmail({ to, subject, message, signLink, workspaceName: workspace.name, replyTo, verifiedSenderEmail, portalUrl });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "sent", sentAt: new Date(), pendingTo: null, pendingSubject: null, pendingMessage: null },
  });
  await prisma.deal.update({ where: { id: deal.id }, data: { status: "sent" } });
  // Resending is how the workspace answers open clause-change requests —
  // whatever they asked for is presumably reflected in this new version.
  await prisma.clauseComment.updateMany({ where: { contractId, resolved: false }, data: { resolved: true } });
}

// Notifies whoever currently holds the given role that a contract needs
// their decision. A failure here should never block the approval-chain
// state change that already happened — it's just a nudge.
export async function notifyStepApprovers(dealId: string, roleId: string): Promise<void> {
  const [deal, role, approvers] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, include: { client: true, template: true } }),
    prisma.role.findUnique({ where: { id: roleId } }),
    prisma.user.findMany({ where: { roleId }, select: { email: true } }),
  ]);
  if (!deal || !role || approvers.length === 0) return;

  try {
    await sendApprovalRequestedEmail({
      to: approvers.map((u) => u.email),
      clientName: deal.client.name,
      templateName: deal.template?.name ?? "contract",
      dealUrl: `${appUrl()}/deals/${dealId}/contract`,
      roleName: role.name,
    });
  } catch (err) {
    console.error("Failed to send approval-requested email", err);
  }
}

// No per-deal owner is tracked, so a rejection notifies the whole team —
// same audience the "email me when a contract is signed" toggle already
// reaches.
export async function notifyChangesRequested(dealId: string, decidedByName: string, note: string | null): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { client: true, template: true, workspace: { include: { users: true } } },
  });
  if (!deal || deal.workspace.users.length === 0) return;

  try {
    await sendChangesRequestedEmail({
      to: deal.workspace.users.map((u) => u.email),
      clientName: deal.client.name,
      templateName: deal.template?.name ?? "contract",
      dealUrl: `${appUrl()}/deals/${dealId}/contract`,
      decidedByName,
      note,
    });
  } catch (err) {
    console.error("Failed to send changes-requested email", err);
  }
}
