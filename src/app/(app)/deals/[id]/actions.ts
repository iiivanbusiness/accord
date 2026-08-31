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

export async function retryExtraction(dealId: string) {
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { template: true } });
  if (!deal || !deal.template) throw new Error("Deal not found");

  try {
    const placeholderKeys = extractPlaceholderKeys(deal.template.clauses);
    await applyExtractionToDeal(dealId, deal.liveTranscript ?? "", placeholderKeys);
  } catch {
    await prisma.deal.update({ where: { id: dealId }, data: { status: "extraction_failed" } });
  }

  redirect(`/deals/${dealId}`);
}

export async function generateContract(dealId: string) {
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { fields: true } });
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
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { fields: true } });
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
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { fields: true } });
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

export async function sendContractEmail(dealId: string, formData: FormData) {
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!to || !subject || !message) throw new Error("To, subject, and message are all required");

  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId }, include: { contract: true } });
  if (!deal || !deal.contract) throw new Error("Deal not found");

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
// looking like it's missing information.
export async function startRenewal(dealId: string) {
  const workspaceId = await requireWorkspaceId();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, workspaceId },
    include: { fields: true, contract: true },
  });
  if (!deal) throw new Error("Deal not found");
  if (deal.contract?.status !== "signed") throw new Error("Only a signed deal can be renewed");

  const newDeal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: deal.clientId,
      templateId: deal.templateId,
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
  const workspaceId = await requireWorkspaceId();
  const item = await prisma.actionItem.findFirst({ where: { id: itemId, dealId, deal: { workspaceId } } });
  if (!item) throw new Error("Action item not found");

  const done = item.status !== "done";
  await prisma.actionItem.update({
    where: { id: itemId },
    data: { status: done ? "done" : "open", doneAt: done ? new Date() : null },
  });

  revalidatePath(`/deals/${dealId}`);
}
