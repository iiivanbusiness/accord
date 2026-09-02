"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { currentUserWithRole } from "@/lib/permissions";
import { performActualSend, notifyStepApprovers, notifyChangesRequested } from "@/lib/approval";
import { logAudit } from "@/lib/audit";

// Invoked from a client component (ApprovalStepper) that wraps this in its
// own try/catch to show inline errors, so this never calls redirect() —
// redirect() throws to signal Next.js, and a client-side catch would treat
// that throw as a failure instead of letting it navigate. revalidatePath
// refreshes the page in place instead, which is also just a better fit
// here: the decider is already looking at this exact page.
export async function decideApproval(dealId: string, approvalId: string, decision: "approve" | "reject", formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const workspaceId = await requireWorkspaceId();

  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { contract: true } });
  if (!deal || !deal.contract) throw new Error("Deal not found");

  const approval = await prisma.contractApproval.findFirst({ where: { id: approvalId, contractId: deal.contract.id } });
  if (!approval) throw new Error("Approval step not found");
  if (approval.status !== "pending") throw new Error("This step was already decided");

  // Steps must be decided strictly in order.
  const earlierUnresolved = await prisma.contractApproval.count({
    where: { contractId: deal.contract.id, order: { lt: approval.order }, status: { not: "approved" } },
  });
  if (earlierUnresolved > 0) throw new Error("An earlier step hasn't been approved yet");

  const user = await currentUserWithRole();
  const directMatch = Boolean(user.role?.canApproveContracts) && user.roleId === approval.roleId;

  // Not a direct holder of the role — check whether someone who IS has
  // actively delegated their approval authority to this person (see
  // ApprovalDelegate: "while I'm out, X can approve on my behalf").
  let onBehalfOfUserId: string | null = null;
  if (!directMatch) {
    const now = new Date();
    const delegation = await prisma.approvalDelegate.findFirst({
      where: {
        toUserId: user.id,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        fromUser: { roleId: approval.roleId, role: { canApproveContracts: true } },
      },
    });
    if (!delegation) throw new Error("You're not eligible to decide this approval step");
    onBehalfOfUserId = delegation.fromUserId;
  }

  if (decision === "reject") {
    await prisma.contractApproval.update({
      where: { id: approvalId },
      data: { status: "rejected", decidedByUserId: user.id, decidedOnBehalfOfUserId: onBehalfOfUserId, decidedAt: new Date(), note },
    });
    await prisma.contract.update({ where: { id: deal.contract.id }, data: { status: "changes_requested" } });
    await prisma.deal.update({ where: { id: dealId }, data: { status: "changes_requested" } });

    await logAudit({ workspaceId, actorEmail: user.email, action: "contract.approval_rejected", targetType: "Deal", targetId: dealId, metadata: { note } });
    await notifyChangesRequested(dealId, user.name, note);

    revalidatePath(`/deals/${dealId}/contract`);
    return;
  }

  const nextStep = await prisma.contractApproval.findFirst({
    where: { contractId: deal.contract.id, order: { gt: approval.order } },
    orderBy: { order: "asc" },
  });

  // For the last step, send FIRST and only mark the step approved once the
  // email actually goes out. If sendContractEmail throws (bad address,
  // Resend outage, whatever), the step stays "pending" so this is simply
  // retryable — the alternative (marking it approved regardless) would
  // strand the contract in pending_approval forever with no pending step
  // left to act on.
  if (!nextStep) {
    await performActualSend(deal.contract.id);
  }

  await prisma.contractApproval.update({
    where: { id: approvalId },
    data: { status: "approved", decidedByUserId: user.id, decidedOnBehalfOfUserId: onBehalfOfUserId, decidedAt: new Date(), note },
  });
  await logAudit({ workspaceId, actorEmail: user.email, action: "contract.approval_approved", targetType: "Deal", targetId: dealId, metadata: { note } });

  if (nextStep) {
    await notifyStepApprovers(dealId, nextStep.roleId);
  }

  revalidatePath(`/deals/${dealId}/contract`);
}
