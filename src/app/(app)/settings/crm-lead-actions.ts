"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { readHubspotFilter, readSalesforceFilter, type CrmSource, type SyncSummary } from "@/lib/crm-leads";
import { hubspotLeadOptions, syncHubspotLeads } from "@/lib/hubspot-leads";
import { salesforceLeadStatuses, syncSalesforceLeads } from "@/lib/salesforce-leads";
import { Prisma } from "@/generated/prisma/client";

type Option = { value: string; label: string };
export type CrmLeadOptions = { groups: { key: string; label: string; options: Option[] }[] };

const crmOf = (v: unknown): CrmSource => (v === "hubspot" ? "hubspot" : "salesforce");

export async function setCrmLeadImport(crm: CrmSource, enabled: boolean): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  const which = crmOf(crm);
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: which === "hubspot" ? { hubspotLeadImport: Boolean(enabled) } : { salesforceLeadImport: Boolean(enabled) },
  });
  await logAudit({ workspaceId: user.workspaceId, actorEmail: user.email, action: `${which}.lead_import.${enabled ? "on" : "off"}` });
  revalidatePath("/settings");
  return {};
}

export async function saveCrmLeadFilter(crm: CrmSource, filter: unknown): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  const which = crmOf(crm);
  const value = (which === "hubspot" ? readHubspotFilter(filter) : readSalesforceFilter(filter)) as unknown as Prisma.InputJsonValue;
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: which === "hubspot" ? { hubspotLeadFilter: value } : { salesforceLeadFilter: value },
  });
  revalidatePath("/settings");
  return {};
}

// What the filter can choose from, read live from the CRM.
export async function loadCrmLeadOptions(crm: CrmSource): Promise<CrmLeadOptions | { error: string }> {
  const user = await requirePermission("canManageWorkspace");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId } });
  try {
    if (crmOf(crm) === "hubspot") {
      if (!workspace.hubspotAccessToken) return { error: "Connect HubSpot first" };
      const { lifecycleStages, leadStatuses } = await hubspotLeadOptions(workspace.hubspotAccessToken);
      return {
        groups: [
          { key: "lifecycleStages", label: "Lifecycle stage", options: lifecycleStages },
          { key: "leadStatuses", label: "Lead status", options: leadStatuses },
        ],
      };
    }
    return { groups: [{ key: "statuses", label: "Lead Status", options: await salesforceLeadStatuses(workspace.id) }] };
  } catch {
    return { error: "Couldn't read the options from your CRM. Check the connection and try again." };
  }
}

// "Sync now". The first sync brings in everything that matches the filter;
// later ones only what changed since.
export async function syncCrmLeadsNow(crm: CrmSource): Promise<SyncSummary | { error: string }> {
  const user = await requirePermission("canManageWorkspace");
  try {
    const summary = crmOf(crm) === "hubspot" ? await syncHubspotLeads(user.workspaceId) : await syncSalesforceLeads(user.workspaceId);
    revalidatePath("/settings");
    revalidatePath("/leads");
    return summary;
  } catch {
    return { error: "The sync didn't finish. Check the connection and try again." };
  }
}

// The Private App's client secret, so HubSpot's webhook calls can be
// checked. Empty clears it (instant updates off).
export async function saveHubspotWebhookSecret(secret: string): Promise<{ error?: string }> {
  const user = await requirePermission("canManageWorkspace");
  const value = typeof secret === "string" ? secret.trim() : "";
  if (value && !/^[A-Za-z0-9-]{20,100}$/.test(value)) return { error: "That doesn't look like a HubSpot client secret" };
  await prisma.workspace.update({ where: { id: user.workspaceId }, data: { hubspotWebhookSecret: value || null } });
  await logAudit({ workspaceId: user.workspaceId, actorEmail: user.email, action: value ? "hubspot.webhook_secret.saved" : "hubspot.webhook_secret.cleared" });
  revalidatePath("/settings");
  return {};
}
