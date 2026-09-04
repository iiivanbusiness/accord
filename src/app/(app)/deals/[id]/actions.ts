"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { applyExtractionToDeal } from "@/lib/deal-live";
import { extractPlaceholderKeys } from "@/lib/contract";
import { auth } from "@/lib/auth";
import { requestOrSendContract } from "@/lib/approval";
import { logAudit } from "@/lib/audit";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import { currentUserWithRole } from "@/lib/permissions";
import { sendReviewRequestedEmail } from "@/lib/email";
import { randomBytes } from "crypto";

export async function retryExtraction(dealId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { template: true } });
  if (!deal || !deal.template) throw new Error("Deal not found");

  try {
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    await applyExtractionToDeal(dealId, deal.liveTranscript ?? "", placeholderKeys);
  } catch {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "extraction_failed" } });
  }

  redirect(`/deals/${dealId}`);
}

// One-click "send it right now" — meant for the moment a deal goes
// "ready" mid-call: instead of the full Send page (to/cc/subject/message,
// extra signers), this fires immediately with sane defaults, routed
// through DocuSign so the client's own DocuSign email is what reaches
// them. Still goes through requestOrSendContract, so a configured
// approval chain still gates it exactly like any other send — this is a
// shortcut to the same pipeline, not a way around it. A confirmation
// click (not a fully silent auto-send) on purpose: the rep glances at the
// terms and decides, rather than the system sending without anyone looking.
export async function sendViaDocusignNow(dealId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId, ...where },
    include: { client: true, template: true, contract: true, workspace: true },
  });
  if (!deal || !deal.contract || !deal.template) throw new Error("Deal not found");
  if (!deal.workspace.docusignEnabled) throw new Error("DocuSign isn't connected for this workspace");
  if (!deal.client.email) throw new Error("This client has no email on file yet — add one first");

  await prisma.contract.update({ where: { id: deal.contract.id }, data: { deliveryMethod: "docusign" } });

  const subject = `${deal.template.name} from ${deal.workspace.name}`;
  const message = `Hi ${deal.client.name.split(" ")[0]},\n\nHere's the ${deal.template.name.toLowerCase()} we just discussed — take a look and sign whenever you're ready.`;

  const session = await auth();
  await requestOrSendContract(dealId, { to: deal.client.email, subject, message }, session?.user?.email);

  revalidatePath(`/deals/${dealId}`);
}

export async function generateContract(dealId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { fields: true } });
  if (!deal) throw new Error("Deal not found");

  const missing = deal.fields.some((f) => f.status === "missing");
  if (missing) throw new Error("Cannot generate a contract while information is missing");

  await prisma.contract.upsert({
    where: { dealId },
    create: { dealId, templateId: deal.templateId, status: "draft" },
    update: {},
  });

  if (deal.status !== "sent" && deal.status !== "signed" && deal.status !== "pending_approval") {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "ready" } });
  }

  redirect(`/deals/${dealId}/contract`);
}

export async function fillMissingFields(dealId: string, formData: FormData) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { fields: true } });
  if (!deal) throw new Error("Deal not found");

  const missingFields = deal.fields.filter((f) => f.status === "missing");
  for (const field of missingFields) {
    const value = String(formData.get(field.id) ?? "").trim();
    if (!value) continue;
    await prisma.dealField.update({
      where: { id: field.id },
      data: { value, status: "confirmed", groupLabel: "Confirmed details" },
    });
  }

  const stillMissing = await prisma.dealField.count({ where: { dealId, status: "missing" } });
  if (stillMissing === 0 && deal.status === "missing_info") {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "ready" } });
  }

  redirect(`/deals/${dealId}`);
}

export async function updateFieldValues(dealId: string, formData: FormData) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { fields: true } });
  if (!deal) throw new Error("Deal not found");

  const editableFields = deal.fields.filter((f) => f.status !== "missing");
  for (const field of editableFields) {
    const value = String(formData.get(field.id) ?? "").trim();
    if (value === field.value) continue;
    if (field.value) {
      await prisma.dealFieldChange.create({
        data: { dealId, fieldKey: field.fieldKey, oldValue: field.value, newValue: value, changedBy: "manual" },
      });
    }
    await prisma.dealField.update({
      where: { id: field.id },
      data: { value, status: "user_edited" },
    });
  }

  redirect(`/deals/${dealId}`);
}

// Applies exactly one field change the rep already confirmed after hearing
// it read back (see /api/deals/[id]/voice-correction) — same
// value/history-tracking shape as updateFieldValues, just for a single
// field triggered from the voice-correction UI instead of the edit form.
export async function applyVoiceFieldCorrection(dealId: string, fieldKey: string, newValue: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { fields: true } });
  if (!deal) throw new Error("Deal not found");

  const field = deal.fields.find((f) => f.fieldKey === fieldKey);
  if (!field) throw new Error("Field not found");

  const value = newValue.trim();
  if (value && value !== field.value) {
    if (field.status === "missing") {
      // Filling in a previously-missing field via voice — same status/group
      // shift as the manual "missing info" form (fillMissingFields), so it
      // moves out of the Missing card into the regular deal-terms groups
      // instead of just sitting there with a value but the wrong status.
      await prisma.dealField.update({ where: { id: field.id }, data: { value, status: "confirmed", groupLabel: "Confirmed details" } });
    } else {
      if (field.value) {
        await prisma.dealFieldChange.create({
          data: { dealId, fieldKey: field.fieldKey, oldValue: field.value, newValue: value, changedBy: "voice" },
        });
      }
      await prisma.dealField.update({ where: { id: field.id }, data: { value, status: "user_edited" } });
    }

    const stillMissing = await prisma.dealField.count({ where: { dealId, status: "missing" } });
    if (stillMissing === 0 && deal.status === "missing_info") {
      await prisma.deal.update({ where: { id: dealId }, data: { status: "ready" } });
    }
  }

  revalidatePath(`/deals/${dealId}`);
}

// Notifies one named teammate to take a look at the deal before it goes
// out — triggered from the voice-correction UI only after the rep taps
// "Yes, apply" on the spoken confirmation (see /api/deals/[id]/voice-correction).
// Ad-hoc and informational, not a gate: unlike an ApprovalChain step, this
// doesn't hold the contract or require a decision — it's the "hey can you
// glance at this" equivalent of a Slack ping, just voice-triggered.
export async function requestTeammateReview(dealId: string, recipientUserId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const currentUser = await currentUserWithRole();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId, ...where },
    include: { client: true, template: true },
  });
  if (!deal) throw new Error("Deal not found");

  const recipient = await prisma.user.findFirst({ where: { id: recipientUserId, workspaceId } });
  if (!recipient) throw new Error("Teammate not found");

  try {
    await sendReviewRequestedEmail({
      to: recipient.email,
      requesterName: currentUser.name,
      clientName: deal.client.name,
      templateName: deal.template?.name ?? "contract",
      dealUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/deals/${dealId}/contract`,
    });
  } catch (err) {
    console.error(`Failed to send review-requested email for deal ${dealId}`, err);
    throw new Error("Couldn't send the email — check your Resend setup and try again");
  }

  await logAudit({
    workspaceId,
    actorEmail: currentUser.email,
    action: "deal.review_requested",
    targetType: "Deal",
    targetId: dealId,
    metadata: { to: recipient.email, via: "voice" },
  });
}

export async function sendContractEmail(dealId: string, formData: FormData) {
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!to || !subject || !message) throw new Error("To, subject, and message are all required");

  const ccRaw = String(formData.get("cc") ?? "").trim();
  const ccList = ccRaw
    ? ccRaw.split(",").map((e) => e.trim()).filter(Boolean)
    : [];

  const signerNames = formData.getAll("signerName").map((v) => String(v).trim());
  const signerEmails = formData.getAll("signerEmail").map((v) => String(v).trim());
  const signerRoles = formData.getAll("signerRole").map((v) => String(v).trim());
  const countersigners = signerNames
    .map((name, i) => ({ name, email: signerEmails[i] ?? "", role: signerRoles[i]?.trim() || "Counter-signer" }))
    .filter((s) => s.name && s.email);

  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId, ...where }, include: { contract: true } });
  if (!deal || !deal.contract) throw new Error("Deal not found");

  const deliveryMethod = String(formData.get("deliveryMethod") ?? "sealme") === "docusign" ? "docusign" : "sealme";

  // CC list, counter-signers, and delivery method are contract setup, not
  // part of the approval-gated email content — stored immediately
  // regardless of whether an approval chain holds the actual send.
  await prisma.contract.update({
    where: { id: deal.contract.id },
    data: { ccEmails: ccList.length > 0 ? JSON.stringify(ccList) : null, deliveryMethod },
  });
  if (countersigners.length > 0) {
    await prisma.contractSigner.deleteMany({ where: { contractId: deal.contract.id, status: "pending" } });
    await prisma.contractSigner.createMany({
      data: countersigners.map((s, i) => ({
        contractId: deal.contract!.id,
        name: s.name,
        email: s.email,
        role: s.role,
        order: i + 1,
        token: randomBytes(24).toString("hex"),
      })),
    });
  }

  const session = await auth();
  try {
    await requestOrSendContract(dealId, { to, subject, message }, session?.user?.email);
  } catch {
    redirect(`/deals/${dealId}/send?error=${encodeURIComponent("Couldn't send the email — check your Resend setup and try again.")}`);
  }

  redirect(`/deals/${dealId}/contract`);
}

// Spins up a fresh deal for the same client, pre-filled with the current
// terms — the "renewal proposal" starting point. Values come in already
// "confirmed" (they're a known-good copy of what the client already signed
// once), so the new deal is immediately reviewable/sendable instead of
// looking like it's missing information. Owned by whoever starts the
// renewal, not carried over from the original deal's owner.
export async function startRenewal(dealId: string) {
  const currentUser = await currentUserWithRole();
  const { where, userId } = await dealVisibilityFilter(currentUser);
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId, ...where },
    include: { fields: true, contract: true },
  });
  if (!deal) throw new Error("Deal not found");
  if (deal.contract?.status !== "signed") throw new Error("Only a signed deal can be renewed");

  const newDeal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: deal.clientId,
      templateId: deal.templateId,
      ownerId: userId,
      teamId: currentUser.teamId,
      service: deal.service,
      feeDisplay: deal.feeDisplay,
      status: "ready",
      source: "renewal",
      fields: {
        create: deal.fields.map((f) => ({
          groupLabel: f.groupLabel,
          label: f.label,
          fieldKey: f.fieldKey,
          value: f.value,
          status: f.value ? "confirmed" : "missing",
          orderIndex: f.orderIndex,
        })),
      },
      contract: { create: { templateId: deal.templateId, status: "draft" } },
    },
  });

  const session = await auth();
  await logAudit({
    workspaceId,
    actorEmail: session?.user?.email,
    action: "deal.renewal_started",
    targetType: "Deal",
    targetId: newDeal.id,
    metadata: { fromDealId: dealId },
  });

  redirect(`/deals/${newDeal.id}/contract`);
}

export async function toggleActionItem(dealId: string, itemId: string) {
  const { where } = await dealVisibilityFilter();
  const workspaceId = await requireWorkspaceId();
  const item = await prisma.actionItem.findFirst({ where: { id: itemId, dealId, deal: { workspaceId, ...where } } });
  if (!item) throw new Error("Action item not found");

  const done = item.status !== "done";
  await prisma.actionItem.update({
    where: { id: itemId },
    data: { status: done ? "done" : "open", doneAt: done ? new Date() : null },
  });

  revalidatePath(`/deals/${dealId}`);
}
