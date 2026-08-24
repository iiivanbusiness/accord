"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendContractEmail as sendEmail } from "@/lib/email";
import { requireWorkspaceId } from "@/lib/workspace";

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

  if (deal.status !== "sent" && deal.status !== "signed") {
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

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { users: true } });
  const signLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign/${deal.contract.id}`;
  const replyTo = workspace?.users[0]?.email ?? null;

  try {
    await sendEmail({ to, subject, message, signLink, workspaceName: workspace?.name ?? "Your workspace", replyTo });
  } catch {
    redirect(`/deals/${dealId}/send?error=${encodeURIComponent("Couldn't send the email — check your Resend setup and try again.")}`);
  }

  await prisma.contract.update({ where: { dealId }, data: { status: "sent", sentAt: new Date() } });
  await prisma.deal.update({ where: { id: dealId }, data: { status: "sent" } });
  redirect(`/deals/${dealId}/contract`);
}
