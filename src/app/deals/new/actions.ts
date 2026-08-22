"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { extractDealFromTranscript, buildDealFieldRows } from "@/lib/extract-deal";
import { extractPlaceholderKeys } from "@/lib/contract";
import { createCallBot, detectPlatformFromUrl } from "@/lib/recall";

export async function createDeal(formData: FormData) {
  const clientName = String(formData.get("clientName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim() || clientName;
  const email = String(formData.get("email") ?? "").trim() || null;
  const service = String(formData.get("service") ?? "").trim();
  const feeDisplay = String(formData.get("feeDisplay") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "") || null;

  if (!clientName || !service || !feeDisplay) {
    throw new Error("Client, service, and fee are required");
  }

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  const client = await prisma.client.create({
    data: { workspaceId: workspace.id, name: clientName, company, email },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      templateId,
      service,
      feeDisplay,
      status: "ready",
      source: "upload",
      fields: {
        create: [
          { groupLabel: "Client & engagement", label: "Client", fieldKey: "clientName", value: clientName, status: "confirmed", orderIndex: 0 },
          { groupLabel: "Client & engagement", label: "Service", fieldKey: "service", value: service, status: "confirmed", orderIndex: 1 },
          { groupLabel: "Commercial terms", label: "Fee", fieldKey: "fee", value: feeDisplay, status: "confirmed", orderIndex: 2 },
        ],
      },
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  redirect(`/deals/${deal.id}`);
}

export async function createDealFromTranscript(formData: FormData) {
  const transcript = String(formData.get("transcript") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!transcript) throw new Error("Paste a call transcript first");
  if (!templateId) throw new Error("Choose a template");

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  const template = await prisma.contractTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template not found");

  const placeholderKeys = extractPlaceholderKeys(template.clauses);

  let extracted;
  try {
    extracted = await extractDealFromTranscript(transcript, placeholderKeys);
  } catch {
    redirect(`/deals/new?error=${encodeURIComponent("Couldn't extract deal terms from that transcript — try again or enter it manually.")}`);
  }

  const { fieldRows, hasMissing, service, fee } = buildDealFieldRows(extracted, placeholderKeys);

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: extracted.clientName,
      company: extracted.company ?? extracted.clientName,
      email: extracted.email,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      templateId,
      service,
      feeDisplay: fee,
      status: hasMissing ? "missing_info" : "ready",
      source: "upload",
      fields: { create: fieldRows },
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  redirect(`/deals/${deal.id}`);
}

export async function startCallBot(formData: FormData) {
  const meetingUrl = String(formData.get("meetingUrl") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!meetingUrl) throw new Error("Paste the meeting link first");
  if (!clientName) throw new Error("Enter who you're meeting with");
  if (!templateId) throw new Error("Choose a template");

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  let bot;
  try {
    bot = await createCallBot(meetingUrl);
  } catch {
    redirect(`/deals/new?mode=live&error=${encodeURIComponent("Couldn't start the call bot — check the meeting link and try again.")}`);
  }

  const client = await prisma.client.create({
    data: { workspaceId: workspace.id, name: clientName, company: clientName },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      templateId,
      service: "",
      feeDisplay: "",
      status: "processing",
      source: detectPlatformFromUrl(meetingUrl),
      recallBotId: bot.id,
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  redirect(`/deals/${deal.id}`);
}
