"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { currentUserWithRole } from "@/lib/permissions";
import { buildDealFieldRows } from "@/lib/extract-deal";
import { extractPlaceholderKeys } from "@/lib/contract";
import { leadHistoryNote } from "@/lib/lead-history";
import { clientCrmIds } from "@/lib/crm-leads";
import { dispatchDealCreated, dispatchWebhookEvent } from "@/lib/webhooks";
import { notifySlack } from "@/lib/slack";
import { syncDealToHubspot } from "@/lib/hubspot";
import { syncDealToSalesforce } from "@/lib/salesforce";
import { reportError } from "@/lib/error-report";

export type ConvertInput = { clientName: string; company: string; email: string; service: string; fee: string; templateId: string };

// "Convert to deal": the lead becomes a client and a deal on the chosen
// template, ready for the usual contract flow. What prospecting learned
// goes with it: the cold calls are linked to the deal and summed up in a
// note on it, and the deal's summary is the last call's.
export async function convertLeadToDeal(leadId: string, input: ConvertInput): Promise<{ error: string }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const user = await currentUserWithRole();

  const clientName = input.clientName?.trim() ?? "";
  const service = input.service?.trim() ?? "";
  const fee = input.fee?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() || null;
  if (!clientName || !service || !fee) return { error: "Client, what they're buying, and the fee are needed" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId: workspace.id, AND: [access.where] },
    include: { phoneCalls: { where: { status: "processed" }, orderBy: { startedAt: "asc" }, include: { user: { select: { name: true } } } } },
  });
  if (!lead) return { error: "Lead not found" };
  if (lead.convertedDealId && (await prisma.deal.findFirst({ where: { id: lead.convertedDealId, workspaceId: workspace.id, trashedAt: null }, select: { id: true } }))) {
    return { error: "This lead is already a deal" };
  }

  const template = await prisma.contractTemplate.findFirst({ where: { id: input.templateId, workspaceId: workspace.id } });
  if (!template) return { error: "Pick a contract template" };

  // The deal belongs to whoever owns the lead (a manager converting a rep's
  // lead hands it to the rep), or to the person converting it.
  const owner = lead.ownerId ? await prisma.user.findFirst({ where: { id: lead.ownerId, workspaceId: workspace.id, deactivatedAt: null }, select: { id: true, teamId: true } }) : null;
  const ownerId = owner?.id ?? user.id;
  const teamId = owner ? owner.teamId : user.teamId;

  // Same person already a client (by email): reuse them rather than make a
  // duplicate.
  const existingClient = email ? await prisma.client.findFirst({ where: { workspaceId: workspace.id, email: { equals: email, mode: "insensitive" } } }) : null;
  const company = input.company?.trim() || clientName;

  const placeholderKeys = extractPlaceholderKeys(template.clauses);
  const { fieldRows, hasMissing } = buildDealFieldRows(
    {
      clientName,
      company,
      email,
      summary: lead.summary,
      fields: [
        { fieldKey: "clientName", value: clientName, sourceQuote: null, confidence: 1 },
        { fieldKey: "service", value: service, sourceQuote: null, confidence: 1 },
        { fieldKey: "fee", value: fee, sourceQuote: null, confidence: 1 },
      ],
    },
    [...new Set(["service", "fee", ...placeholderKeys])],
  );
  // Typed in by a person, not read off a call.
  const rows = fieldRows.map((f) => (f.status === "extracted" ? { ...f, status: "confirmed", confidence: null } : f));

  const history = leadHistoryNote(lead, lead.phoneCalls, `by ${user.name}`);

  const deal = await prisma.$transaction(async (tx) => {
    const client =
      existingClient ?? (await tx.client.create({ data: { workspaceId: workspace.id, name: clientName, company, email, phone: lead.phone, ...clientCrmIds(lead) } }));
    const deal = await tx.deal.create({
      data: {
        workspaceId: workspace.id,
        clientId: client.id,
        templateId: template.id,
        ownerId,
        teamId,
        service,
        feeDisplay: fee,
        status: hasMissing ? "missing_info" : "ready",
        source: "manual",
        summary: lead.summary,
        fields: { create: rows },
        notes: { create: { authorEmail: user.email, authorName: user.name, body: history } },
      },
    });
    await tx.phoneCall.updateMany({ where: { leadId: lead.id }, data: { dealId: deal.id } });
    await tx.lead.update({
      where: { id: lead.id },
      data: { stage: "converted", convertedAt: lead.convertedAt ?? new Date(), convertedClientId: client.id, convertedDealId: deal.id },
    });
    return deal;
  });

  after(async () => {
    try {
      await dispatchDealCreated(workspace.id, deal.id);
      await dispatchWebhookEvent(workspace.id, "lead.converted", { leadId: lead.id, dealId: deal.id, clientId: deal.clientId, name: lead.name, company: lead.company, convertedAt: new Date().toISOString() });
      await notifySlack(workspace.id, { type: "deal.created", dealId: deal.id, clientName, service });
      await syncDealToHubspot(workspace.id, deal.id);
      await syncDealToSalesforce(workspace.id, deal.id);
    } catch (err) {
      await reportError(err, "Integrations after converting a lead", { dealId: deal.id });
    }
  });

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/leads");
  redirect(`/deals/${deal.id}`);
}
