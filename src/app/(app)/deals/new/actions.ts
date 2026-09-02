"use server";

import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { extractDealFromTranscript, buildDealFieldRows } from "@/lib/extract-deal";
import { extractActionItems } from "@/lib/extract-action-items";
import { extractPlaceholderKeys } from "@/lib/contract";
import { createCallBot, detectPlatformFromUrl } from "@/lib/recall";
import { requireWorkspace } from "@/lib/workspace";
import { currentUserWithRole } from "@/lib/permissions";
import { dispatchWebhookEvent } from "@/lib/webhooks";

// Every path here costs real money one way or another (Anthropic tokens for
// extraction, a live Recall bot-minute for calls) — callsLimit was tracked
// and shown in the UI but never actually enforced, so a workspace could run
// past its plan indefinitely. This is the one place all four entry points
// funnel through before doing anything billable.
function assertUnderCallLimit(workspace: { callsUsedThisMonth: number; callsLimit: number }) {
  if (workspace.callsUsedThisMonth >= workspace.callsLimit) {
    redirect(`/deals/new?error=${encodeURIComponent("You've used all your calls for this billing period — upgrade your plan to start more.")}`);
  }
}

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

  const [workspace, user] = await Promise.all([requireWorkspace(), currentUserWithRole()]);
  assertUnderCallLimit(workspace);
  const workspaceId = workspace.id;

  const client = await prisma.client.create({
    data: { workspaceId, name: clientName, company, email },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: client.id,
      templateId,
      ownerId: user.id,
      teamId: user.teamId,
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
    where: { id: workspaceId },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  await dispatchWebhookEvent(workspaceId, "deal.created", { dealId: deal.id, clientName, company, service, feeDisplay, status: deal.status });

  redirect(`/deals/${deal.id}`);
}

export async function createDealFromTranscript(formData: FormData) {
  const transcript = String(formData.get("transcript") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!transcript) throw new Error("Paste a call transcript first");
  if (!templateId) throw new Error("Choose a template");

  const [workspace, user] = await Promise.all([requireWorkspace(), currentUserWithRole()]);
  assertUnderCallLimit(workspace);
  const workspaceId = workspace.id;

  const template = await prisma.contractTemplate.findFirst({ where: { id: templateId, workspaceId } });
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
      workspaceId,
      name: extracted.clientName,
      company: extracted.company ?? extracted.clientName,
      email: extracted.email,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: client.id,
      templateId,
      ownerId: user.id,
      teamId: user.teamId,
      service,
      feeDisplay: fee,
      status: hasMissing ? "missing_info" : "ready",
      summary: extracted.summary,
      source: "upload",
      fields: { create: fieldRows },
      calls: { create: { transcript, source: "upload", endedAt: new Date() } },
    },
    include: { calls: true },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  try {
    await extractActionItems(deal.calls[0].id);
  } catch (err) {
    console.error(`Failed to extract action items for deal ${deal.id}`, err);
  }

  await dispatchWebhookEvent(workspaceId, "deal.created", { dealId: deal.id, clientName: extracted.clientName, service, feeDisplay: fee, status: deal.status });

  redirect(`/deals/${deal.id}`);
}

export async function startCallFromEvent(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!eventId) throw new Error("Choose a calendar event");
  if (!templateId) throw new Error("Choose a template");

  const [workspace, user] = await Promise.all([requireWorkspace(), currentUserWithRole()]);
  assertUnderCallLimit(workspace);
  const workspaceId = workspace.id;

  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, workspaceId } });
  if (!event || !event.meetingUrl) throw new Error("That event doesn't have a meeting link");

  // Recall only guarantees an on-time join for bots scheduled >10 min ahead —
  // anything closer (or already started) falls back to joining right away.
  const tenMinFromNow = Date.now() + 10 * 60 * 1000;
  const joinAt = event.startTime.getTime() > tenMinFromNow ? event.startTime : undefined;

  let bot;
  try {
    bot = await createCallBot(event.meetingUrl, joinAt);
  } catch (err) {
    console.error("Failed to schedule call bot for calendar event", eventId, err);
    redirect(`/deals/new?mode=live&error=${encodeURIComponent("Couldn't schedule the call bot — check the event's meeting link and try again.")}`);
  }

  const clientName = event.clientName || event.title;
  const client = await prisma.client.create({
    data: { workspaceId, name: clientName, company: clientName },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: client.id,
      templateId,
      ownerId: user.id,
      teamId: user.teamId,
      service: "",
      feeDisplay: "",
      status: "processing",
      source: detectPlatformFromUrl(event.meetingUrl),
      recallBotId: bot.id,
    },
  });

  await prisma.calendarEvent.update({ where: { id: eventId }, data: { linkedDealId: deal.id } });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  await dispatchWebhookEvent(workspaceId, "deal.created", { dealId: deal.id, clientName, status: deal.status });

  redirect(`/deals/${deal.id}`);
}

// Desktop-app-only: starts a deal backed by a locally-recorded call instead
// of a Recall bot. Unlike the other actions here, this one returns a value
// instead of redirecting — the caller is a client component that still needs
// to kick off native audio capture (via Tauri) before navigating, and needs
// the upload token back to authenticate that capture's later upload.
export async function startLocalCapture(formData: FormData): Promise<{ dealId: string; token: string } | { error: string }> {
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim() || null;
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!clientName) return { error: "Enter who you're meeting with" };
  if (!templateId) return { error: "Choose a template" };

  const [workspace, user] = await Promise.all([requireWorkspace(), currentUserWithRole()]);
  if (workspace.callsUsedThisMonth >= workspace.callsLimit) {
    return { error: "You've used all your calls for this billing period — upgrade your plan to start more." };
  }
  const workspaceId = workspace.id;

  const client = await prisma.client.create({
    data: { workspaceId, name: clientName, company: clientName, email: clientEmail },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: client.id,
      templateId,
      ownerId: user.id,
      teamId: user.teamId,
      service: "",
      feeDisplay: "",
      status: "processing",
      source: "local",
    },
  });

  const call = await prisma.call.create({ data: { dealId: deal.id, source: "local" } });
  const rawToken = await mintLocalCaptureToken(workspaceId, deal.id, call.id);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  await dispatchWebhookEvent(workspaceId, "deal.created", { dealId: deal.id, clientName, status: deal.status });

  return { dealId: deal.id, token: rawToken };
}

// Shared by startLocalCapture (brand-new deal) and continueLocalCapture (a
// follow-up call on an existing deal) — one Call, one token, always.
async function mintLocalCaptureToken(workspaceId: string, dealId: string, callId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await prisma.localCaptureToken.create({
    data: {
      workspaceId,
      dealId,
      callId,
      tokenHash,
      // 4h covers even an unusually long call — the token is single-use and
      // burned the moment the recording is uploaded, well before that.
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });
  return rawToken;
}

// Attaches a follow-up call to a deal that already exists, instead of
// spawning a new deal + client for what's really a continuation of the
// same negotiation. Reuses the deal's existing template.
export async function continueLocalCapture(dealId: string): Promise<{ dealId: string; token: string } | { error: string }> {
  const workspace = await requireWorkspace();
  if (workspace.callsUsedThisMonth >= workspace.callsLimit) {
    return { error: "You've used all your calls for this billing period — upgrade your plan to start more." };
  }

  const deal = await prisma.deal.findFirst({ where: { id: dealId, workspaceId: workspace.id } });
  if (!deal) return { error: "Deal not found" };
  if (deal.status === "signed") return { error: "This deal is already signed — start a new deal instead" };

  const call = await prisma.call.create({ data: { dealId, source: "local" } });
  const rawToken = await mintLocalCaptureToken(workspace.id, dealId, call.id);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  return { dealId, token: rawToken };
}

export async function startCallBot(formData: FormData) {
  const meetingUrl = String(formData.get("meetingUrl") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!meetingUrl) throw new Error("Paste the meeting link first");
  if (!clientName) throw new Error("Enter who you're meeting with");
  if (!templateId) throw new Error("Choose a template");

  const [workspace, user] = await Promise.all([requireWorkspace(), currentUserWithRole()]);
  assertUnderCallLimit(workspace);
  const workspaceId = workspace.id;

  let bot;
  try {
    bot = await createCallBot(meetingUrl);
  } catch (err) {
    console.error("Failed to start call bot", err);
    redirect(`/deals/new?mode=live&error=${encodeURIComponent("Couldn't start the call bot — check the meeting link and try again.")}`);
  }

  const client = await prisma.client.create({
    data: { workspaceId, name: clientName, company: clientName },
  });

  const deal = await prisma.deal.create({
    data: {
      workspaceId,
      clientId: client.id,
      templateId,
      ownerId: user.id,
      teamId: user.teamId,
      service: "",
      feeDisplay: "",
      status: "processing",
      source: detectPlatformFromUrl(meetingUrl),
      recallBotId: bot.id,
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { callsUsedThisMonth: { increment: 1 } },
  });

  await dispatchWebhookEvent(workspaceId, "deal.created", { dealId: deal.id, clientName, status: deal.status });

  redirect(`/deals/${deal.id}`);
}
