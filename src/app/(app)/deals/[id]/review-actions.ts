"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { currentUserWithRole } from "@/lib/permissions";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { performActualSend, notifyStepAssignee, notifyChangesRequested } from "@/lib/review";
import { logAudit } from "@/lib/audit";

type ReviewStepWithAssignee = { id: string; assigneeId: string; contractId: string };

// Shared by decideReviewStep and every checklist/comment mutation: is this
// user allowed to act on this step? Either they're the named assignee
// directly, or someone who IS has actively delegated to them (see
// ApprovalDelegate — "while I'm out, X can review on my behalf"). Returns
// the delegator's id for the audit trail when it's a delegate acting, or
// null when it's the assignee acting directly.
async function checkReviewStepEligibility(reviewStep: ReviewStepWithAssignee, userId: string): Promise<{ eligible: boolean; onBehalfOfUserId: string | null }> {
  if (reviewStep.assigneeId === userId) return { eligible: true, onBehalfOfUserId: null };

  const now = new Date();
  const delegation = await prisma.approvalDelegate.findFirst({
    where: {
      toUserId: userId,
      fromUserId: reviewStep.assigneeId,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });
  if (!delegation) return { eligible: false, onBehalfOfUserId: null };
  return { eligible: true, onBehalfOfUserId: delegation.fromUserId };
}

// Manual "Send to X" — the informal override sitting alongside the
// automatic ReviewChain: pick anyone, at any time, and the review routes
// to them right now. If a step is already active, this REASSIGNS it
// (keeps order/priority/checklist/comments/history, just changes who's
// responsible) rather than adding a new one — that's what lets it
// redirect mid-chain instead of only working when nothing is in flight.
// If nothing is active (never sent for review, or the chain already
// finished), it starts a fresh step. Open to any workspace member who can
// see the deal, same visibility gate as a deal note/comment — this is
// deliberately informal, not an admin-only action.
export async function sendForReviewTo(dealId: string, assigneeId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId, ...where },
    include: { contract: true, client: true, template: true, workspace: true },
  });
  if (!deal || !deal.contract) throw new Error("Generate a contract for this deal first");

  const assignee = await prisma.user.findFirst({ where: { id: assigneeId, workspaceId } });
  if (!assignee) throw new Error("Teammate not found");

  const activeStep = await prisma.reviewStep.findFirst({ where: { contractId: deal.contract.id, status: "pending" }, orderBy: { order: "asc" } });
  const startingFreshChain = !activeStep && deal.contract.status !== "sent" && deal.contract.status !== "signed";

  // A chain kicked off from the contract page's compose form already has
  // pendingTo/Subject/Message stored (requestOrSendReview), but this manual
  // "Send to" button skips that form entirely — without a fallback here,
  // the LAST step's approval would have nothing to actually email the
  // client with. Generate the same defaults sendViaDocusignNow uses, and
  // validate BEFORE writing anything so a missing client email fails clean
  // instead of leaving an orphaned review step behind.
  const needsPendingEmail = startingFreshChain && !deal.contract.pendingTo && !deal.contract.pendingSubject && !deal.contract.pendingMessage;
  if (needsPendingEmail && !deal.client.email) {
    throw new Error("This client has no email on file yet. Add one before sending for review");
  }

  let stepId: string;
  if (activeStep) {
    await prisma.reviewStep.update({ where: { id: activeStep.id }, data: { assigneeId } });
    stepId = activeStep.id;
  } else {
    const maxOrder = await prisma.reviewStep.aggregate({ where: { contractId: deal.contract.id }, _max: { order: true } });
    const order = (maxOrder._max.order ?? 0) + 1;
    const created = await prisma.reviewStep.create({ data: { contractId: deal.contract.id, assigneeId, order, status: "pending" } });
    stepId = created.id;

    if (startingFreshChain) {
      const contractUpdate: { status: string; pendingTo?: string; pendingSubject?: string; pendingMessage?: string } = {
        status: "pending_approval",
      };
      if (needsPendingEmail) {
        contractUpdate.pendingTo = deal.client.email!;
        contractUpdate.pendingSubject = `${deal.template?.name ?? "Contract"} from ${deal.workspace.name}`;
        contractUpdate.pendingMessage = `Hi ${deal.client.name.split(" ")[0]},\n\nHere's the ${(deal.template?.name ?? "contract").toLowerCase()} we just discussed. Take a look and sign whenever you're ready.`;
      }
      await prisma.contract.update({ where: { id: deal.contract.id }, data: contractUpdate });
      await prisma.deal.update({ where: { id: dealId }, data: { status: "pending_approval" } });
    }
  }

  const session = await currentUserWithRole();
  await logAudit({ workspaceId, actorEmail: session.email, action: "contract.sent_for_review", targetType: "Deal", targetId: dealId, metadata: { assignee: assignee.name } });

  await notifyStepAssignee(dealId, stepId);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

// Invoked from a client component (ReviewPanel) that wraps this in its
// own try/catch to show inline errors, so this never calls redirect() —
// redirect() throws to signal Next.js, and a client-side catch would treat
// that throw as a failure instead of letting it navigate. revalidatePath
// refreshes the page in place instead, which is also just a better fit
// here: the decider is already looking at this exact page.
export async function decideReviewStep(dealId: string, reviewStepId: string, decision: "approve" | "reject", formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const workspaceId = await requireWorkspaceId();

  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { contract: true } });
  if (!deal || !deal.contract) throw new Error("Deal not found");

  const reviewStep = await prisma.reviewStep.findFirst({ where: { id: reviewStepId, contractId: deal.contract.id } });
  if (!reviewStep) throw new Error("Review step not found");
  if (reviewStep.status !== "pending") throw new Error("This step was already decided");

  // Steps must be decided strictly in order.
  const earlierUnresolved = await prisma.reviewStep.count({
    where: { contractId: deal.contract.id, order: { lt: reviewStep.order }, status: { not: "approved" } },
  });
  if (earlierUnresolved > 0) throw new Error("An earlier step hasn't been approved yet");

  const user = await currentUserWithRole();
  const { eligible, onBehalfOfUserId } = await checkReviewStepEligibility(reviewStep, user.id);
  if (!eligible) throw new Error("You're not eligible to decide this review step");

  if (decision === "reject") {
    await prisma.reviewStep.update({
      where: { id: reviewStepId },
      data: { status: "rejected", decidedByUserId: user.id, decidedOnBehalfOfUserId: onBehalfOfUserId, decidedAt: new Date(), note },
    });
    await prisma.contract.update({ where: { id: deal.contract.id }, data: { status: "changes_requested" } });
    await prisma.deal.update({ where: { id: dealId }, data: { status: "changes_requested" } });

    await logAudit({ workspaceId, actorEmail: user.email, action: "contract.approval_rejected", targetType: "Deal", targetId: dealId, metadata: { note } });
    await notifyChangesRequested(dealId, user.name, note);

    revalidatePath(`/deals/${dealId}`);
    revalidatePath(`/deals/${dealId}/contract`);
    return;
  }

  const nextStep = await prisma.reviewStep.findFirst({
    where: { contractId: deal.contract.id, order: { gt: reviewStep.order } },
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

  await prisma.reviewStep.update({
    where: { id: reviewStepId },
    data: { status: "approved", decidedByUserId: user.id, decidedOnBehalfOfUserId: onBehalfOfUserId, decidedAt: new Date(), note },
  });
  await logAudit({ workspaceId, actorEmail: user.email, action: "contract.approval_approved", targetType: "Deal", targetId: dealId, metadata: { note } });

  if (nextStep) {
    await notifyStepAssignee(dealId, nextStep.id);
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

export async function addChecklistItem(dealId: string, reviewStepId: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Enter a checklist item");

  const workspaceId = await requireWorkspaceId();
  const reviewStep = await prisma.reviewStep.findFirst({ where: { id: reviewStepId, contract: { deal: { id: dealId, workspaceId } } } });
  if (!reviewStep) throw new Error("Review step not found");

  const user = await currentUserWithRole();
  const { eligible } = await checkReviewStepEligibility(reviewStep, user.id);
  if (!eligible) throw new Error("You're not eligible to edit this review step");

  await prisma.reviewChecklistItem.create({ data: { reviewStepId, label } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

export async function toggleChecklistItem(dealId: string, itemId: string, done: boolean) {
  const workspaceId = await requireWorkspaceId();
  const item = await prisma.reviewChecklistItem.findFirst({
    where: { id: itemId, reviewStep: { contract: { deal: { id: dealId, workspaceId } } } },
    include: { reviewStep: true },
  });
  if (!item) throw new Error("Checklist item not found");

  const user = await currentUserWithRole();
  const { eligible } = await checkReviewStepEligibility(item.reviewStep, user.id);
  if (!eligible) throw new Error("You're not eligible to edit this review step");

  await prisma.reviewChecklistItem.update({ where: { id: itemId }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

export async function removeChecklistItem(dealId: string, itemId: string) {
  const workspaceId = await requireWorkspaceId();
  const item = await prisma.reviewChecklistItem.findFirst({
    where: { id: itemId, reviewStep: { contract: { deal: { id: dealId, workspaceId } } } },
    include: { reviewStep: true },
  });
  if (!item) throw new Error("Checklist item not found");

  const user = await currentUserWithRole();
  const { eligible } = await checkReviewStepEligibility(item.reviewStep, user.id);
  if (!eligible) throw new Error("You're not eligible to edit this review step");

  await prisma.reviewChecklistItem.delete({ where: { id: itemId } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

// Comments are visible workspace-wide (same as DealNote) — anyone signed
// into the workspace can leave one, not just the step's assignee, since a
// comment is a lighter-weight "hey, noticed this" than the actual decision.
export async function addReviewComment(dealId: string, reviewStepId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty");

  const workspaceId = await requireWorkspaceId();
  const reviewStep = await prisma.reviewStep.findFirst({ where: { id: reviewStepId, contract: { deal: { id: dealId, workspaceId } } } });
  if (!reviewStep) throw new Error("Review step not found");

  const user = await currentUserWithRole();
  await prisma.reviewComment.create({ data: { reviewStepId, authorEmail: user.email, authorName: user.name, body: trimmed } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

export async function deleteReviewComment(dealId: string, commentId: string) {
  const workspaceId = await requireWorkspaceId();
  const comment = await prisma.reviewComment.findFirst({ where: { id: commentId, reviewStep: { contract: { deal: { id: dealId, workspaceId } } } } });
  if (!comment) throw new Error("Comment not found");

  const user = await currentUserWithRole();
  if (comment.authorEmail !== user.email) throw new Error("You can only delete your own comments");

  await prisma.reviewComment.delete({ where: { id: commentId } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}

// Set or clear a step's due date / priority — either the assignee
// themselves or anyone who can manage the workspace (an admin helping
// triage) can adjust these; they're not part of the approve/reject
// decision itself.
export async function updateReviewStepMeta(dealId: string, reviewStepId: string, formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const reviewStep = await prisma.reviewStep.findFirst({ where: { id: reviewStepId, contract: { deal: { id: dealId, workspaceId } } } });
  if (!reviewStep) throw new Error("Review step not found");

  const user = await currentUserWithRole();
  const { eligible } = await checkReviewStepEligibility(reviewStep, user.id);
  if (!eligible && !user.role?.canManageWorkspace) throw new Error("You're not eligible to edit this review step");

  const priority = String(formData.get("priority") ?? "normal");
  if (!["low", "normal", "high", "urgent"].includes(priority)) throw new Error("Invalid priority");

  const rawDueAt = String(formData.get("dueAt") ?? "").trim();
  const dueAt = rawDueAt ? new Date(rawDueAt) : null;
  if (rawDueAt && Number.isNaN(dueAt?.getTime())) throw new Error("Invalid due date");

  await prisma.reviewStep.update({ where: { id: reviewStepId }, data: { priority, dueAt, dueReminderSentAt: null } });
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/contract`);
}
