import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";

// A per-workspace OAuth connection to the WORKSPACE'S OWN Salesforce org —
// same shape as docusign.ts, not a SealMe-owned shared install like Slack.
// The Connected App is registered under SealMe's name, but the
// authorization and the org itself belong to the customer. Salesforce's
// login/token endpoints are always on login.salesforce.com regardless of
// which org you're connecting to (Developer Edition included — it's not a
// sandbox, so we never touch test.salesforce.com here); every API call
// afterward goes to the org-specific instanceUrl returned by the token
// exchange, not a fixed host. Pushes Client as Contact and Deal as
// Opportunity — see syncDealToSalesforce below.

const LOGIN_URL = "https://login.salesforce.com";
const API_VERSION = "v62.0";

export function isSalesforceConfigured(): boolean {
  return Boolean(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/salesforce/callback`;
}

export function buildSalesforceAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SALESFORCE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    scope: "api refresh_token offline_access",
  });
  return `${LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;
}

type SalesforceTokenResponse = {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string; // identity URL, e.g. https://login.salesforce.com/id/00Dxx/005xx
  token_type: string;
};

type SalesforceIdentity = { email: string };

async function requestToken(body: URLSearchParams): Promise<SalesforceTokenResponse> {
  body.set("client_id", process.env.SALESFORCE_CLIENT_ID ?? "");
  body.set("client_secret", process.env.SALESFORCE_CLIENT_SECRET ?? "");
  const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Salesforce token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<SalesforceTokenResponse>;
}

async function fetchIdentity(idUrl: string, accessToken: string): Promise<SalesforceIdentity> {
  const res = await fetch(idUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Couldn't read Salesforce identity: ${res.status}`);
  return res.json() as Promise<SalesforceIdentity>;
}

export async function exchangeSalesforceCode(code: string): Promise<{
  accessToken: string; refreshToken: string; instanceUrl: string; accountEmail: string;
}> {
  const tokens = await requestToken(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }));
  if (!tokens.refresh_token) throw new Error("Salesforce didn't return a refresh token — check the Connected App's OAuth scopes include 'refresh_token, offline_access'");
  const identity = await fetchIdentity(tokens.id, tokens.access_token);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    instanceUrl: tokens.instance_url,
    accountEmail: identity.email,
  };
}

// Salesforce access tokens don't come with a fixed expires_in — they can
// go invalid at any time (session timeout policy, admin revocation, etc).
// So unlike docusign.ts's proactive expiry check, this refreshes reactively:
// try the stored token, and only refresh + retry once on a 401.
async function getWorkspaceCreds(workspaceId: string): Promise<{ accessToken: string; instanceUrl: string; refreshToken: string }> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.salesforceRefreshToken || !workspace.salesforceInstanceUrl || !workspace.salesforceAccessToken) {
    throw new Error("Salesforce isn't connected for this workspace");
  }
  return {
    accessToken: workspace.salesforceAccessToken,
    instanceUrl: workspace.salesforceInstanceUrl,
    refreshToken: workspace.salesforceRefreshToken,
  };
}

async function refreshAccessToken(workspaceId: string, refreshToken: string): Promise<string> {
  const refreshed = await requestToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { salesforceAccessToken: refreshed.access_token, salesforceTokenExpiresAt: null },
  });
  return refreshed.access_token;
}

// One authenticated call to the org's REST API, transparently refreshing
// and retrying exactly once on a 401 (expired/invalid session).
async function sfFetch(workspaceId: string, path: string, init?: RequestInit): Promise<Response> {
  const { accessToken, instanceUrl, refreshToken } = await getWorkspaceCreds(workspaceId);
  const doFetch = (token: string) =>
    fetch(`${instanceUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const fresh = await refreshAccessToken(workspaceId, refreshToken);
    res = await doFetch(fresh);
  }
  return res;
}

// Creates the Contact on first sync, updates it on every later one —
// salesforceContactId on our Client row is the join key. Mirrors
// hubspot.ts's upsertContact. Salesforce Contacts require a LastName;
// we split our single `name` field the same way as hubspot's `firstname`.
async function upsertContact(workspaceId: string, client: { id: string; name: string; company: string; email: string | null; salesforceContactId: string | null }): Promise<string> {
  const parts = client.name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "Unknown";
  const firstName = parts.length > 1 ? parts[0] : undefined;
  const fields = { LastName: lastName, FirstName: firstName, Email: client.email ?? undefined };

  if (client.salesforceContactId) {
    const res = await sfFetch(workspaceId, `/services/data/${API_VERSION}/sobjects/Contact/${client.salesforceContactId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    if (!res.ok && res.status !== 204) throw new Error(`Salesforce Contact update failed: ${res.status} ${await res.text()}`);
    return client.salesforceContactId;
  }

  const res = await sfFetch(workspaceId, `/services/data/${API_VERSION}/sobjects/Contact`, {
    method: "POST",
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Salesforce Contact creation failed: ${res.status} ${await res.text()}`);
  const created = (await res.json()) as { id: string };
  await prisma.client.update({ where: { id: client.id }, data: { salesforceContactId: created.id } });
  return created.id;
}

// SealMe's own deal statuses don't map 1:1 to Salesforce's default
// Opportunity stages, so we collapse to the closest default stage —
// customers with custom stage picklists can remap this later, but these
// are guaranteed to exist on every fresh org.
const STAGE_BY_STATUS: Record<string, string> = {
  processing: "Qualification",
  missing_info: "Qualification",
  extraction_failed: "Qualification",
  ready: "Proposal/Price Quote",
  pending_approval: "Proposal/Price Quote",
  changes_requested: "Proposal/Price Quote",
  sent: "Negotiation/Review",
  signed: "Closed Won",
};

function closeDateFor(status: string, updatedAt: Date): string {
  // Opportunities require a CloseDate. Signed deals close on the day they
  // were signed; anything still open gets a placeholder 30 days out so it
  // shows up on pipeline reports instead of looking overdue.
  const base = status === "signed" ? updatedAt : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return base.toISOString().slice(0, 10);
}

async function upsertOpportunity(
  workspaceId: string,
  deal: { id: string; service: string; feeDisplay: string; status: string; updatedAt: Date; salesforceOpportunityId: string | null },
  contactId: string
): Promise<string> {
  const amount = parseFee(deal.feeDisplay);
  const fields: Record<string, unknown> = {
    Name: deal.service || "SealMe deal",
    StageName: STAGE_BY_STATUS[deal.status] ?? "Qualification",
    CloseDate: closeDateFor(deal.status, deal.updatedAt),
    Amount: amount || undefined,
  };

  let opportunityId: string;
  if (deal.salesforceOpportunityId) {
    const res = await sfFetch(workspaceId, `/services/data/${API_VERSION}/sobjects/Opportunity/${deal.salesforceOpportunityId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    if (!res.ok && res.status !== 204) throw new Error(`Salesforce Opportunity update failed: ${res.status} ${await res.text()}`);
    opportunityId = deal.salesforceOpportunityId;
  } else {
    const res = await sfFetch(workspaceId, `/services/data/${API_VERSION}/sobjects/Opportunity`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(`Salesforce Opportunity creation failed: ${res.status} ${await res.text()}`);
    const created = (await res.json()) as { id: string };
    opportunityId = created.id;
    await prisma.deal.update({ where: { id: deal.id }, data: { salesforceOpportunityId: opportunityId } });
  }

  // Best-effort — an Opportunity synced without its Contact role linked is
  // still useful, so a failure here shouldn't undo the upserts above.
  try {
    await sfFetch(workspaceId, `/services/data/${API_VERSION}/sobjects/OpportunityContactRole`, {
      method: "POST",
      body: JSON.stringify({ OpportunityId: opportunityId, ContactId: contactId, IsPrimary: true }),
    });
  } catch (err) {
    console.error(`Salesforce OpportunityContactRole link failed for opportunity ${opportunityId}`, err);
  }

  return opportunityId;
}

// Pushes one deal (and its client, as a Contact) to Salesforce — called
// alongside syncDealToHubspot/dispatchWebhookEvent/notifySlack at the same
// event sites (deal.created, contract.sent, contract.signed). Never throws
// into the caller; failures are logged only, same contract as HubSpot's.
export async function syncDealToSalesforce(workspaceId: string, dealId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.salesforceEnabled || !workspace.salesforceAccessToken) return;

  try {
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { client: true } });
    if (!deal) return;

    const contactId = await upsertContact(workspaceId, deal.client);
    await upsertOpportunity(workspaceId, deal, contactId);
  } catch (err) {
    console.error(`Salesforce sync failed for deal ${dealId}`, err);
  }
}
