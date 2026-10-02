import { syncHubspotLeads } from "@/lib/hubspot-leads";
import { syncSalesforceLeads } from "@/lib/salesforce-leads";
import { reportError } from "@/lib/error-report";

type WorkspaceSyncState = {
  id: string;
  salesforceLeadImport: boolean;
  salesforceRefreshToken: string | null;
  salesforceLeadsSyncedAt: Date | null;
  hubspotLeadImport: boolean;
  hubspotAccessToken: string | null;
  hubspotLeadsSyncedAt: Date | null;
};

// How stale a CRM's leads may get before opening Leads pulls changes.
// Salesforce has no push on the free path, so it's checked often; HubSpot
// pushes by webhook, so this only catches anything a webhook missed.
const SALESFORCE_EVERY_MS = 5 * 60 * 1000;
const HUBSPOT_EVERY_MS = 30 * 60 * 1000;

// Runs whichever CRM syncs are due. Meant for after(): never throws.
export async function syncCrmLeadsIfDue(ws: WorkspaceSyncState, options: { force?: boolean; budgetMs?: number } = {}): Promise<void> {
  const now = Date.now();
  if (ws.salesforceLeadImport && ws.salesforceRefreshToken && (options.force || !ws.salesforceLeadsSyncedAt || now - ws.salesforceLeadsSyncedAt.getTime() > SALESFORCE_EVERY_MS)) {
    try {
      await syncSalesforceLeads(ws.id, { budgetMs: options.budgetMs });
    } catch (err) {
      await reportError(err, "Salesforce lead sync", { workspaceId: ws.id });
    }
  }
  if (ws.hubspotLeadImport && ws.hubspotAccessToken && (options.force || !ws.hubspotLeadsSyncedAt || now - ws.hubspotLeadsSyncedAt.getTime() > HUBSPOT_EVERY_MS)) {
    try {
      await syncHubspotLeads(ws.id, { budgetMs: options.budgetMs });
    } catch (err) {
      await reportError(err, "HubSpot lead sync", { workspaceId: ws.id });
    }
  }
}
