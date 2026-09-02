import { prisma } from "@/lib/db";
import { parseFee } from "@/lib/money";

// One SealMe-owned HubSpot app, installed per-workspace via OAuth — same
// shared-app model as Slack. Deliberately one-directional (SealMe pushes
// TO HubSpot, never reads from it): a real two-way sync needs HubSpot's
// own webhook subscriptions and conflict resolution on top of this, which
// is its own separate decision if a customer actually needs it — this
// covers the "keep my CRM automatically up to date" case, which is most
// of the value.
const SCOPES = "crm.objects.contacts.write crm.objects.contacts.read crm.objects.deals.write crm.objects.deals.read oauth";

export function isHubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/hubspot/callback`;
}

export function buildHubspotAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    scope: SCOPES,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

type HubspotTokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function requestToken(body: URLSearchParams): Promise<HubspotTokenResponse> {
  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`HubSpot token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<HubspotTokenResponse>;
}

export async function exchangeHubspotCode(code: string): Promise<HubspotTokenResponse & { portalId: string }> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
      client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      code,
    })
  );

  const infoRes = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${tokens.access_token}`);
  if (!infoRes.ok) throw new Error(`Couldn't read HubSpot token info: ${infoRes.status}`);
  const info = (await infoRes.json()) as { hub_id: number };

  return { ...tokens, portalId: String(info.hub_id) };
}

async function refreshToken(refreshTokenValue: string): Promise<HubspotTokenResponse> {
  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
      client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
      refresh_token: refreshTokenValue,
    })
  );
}

// Returns a live access token, refreshing first if it's missing/expired —
// same shape as google-calendar.ts's own token handling.
async function getValidAccessToken(workspaceId: string): Promise<string> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.hubspotRefreshToken) throw new Error("HubSpot isn't connected for this workspace");

  const expired = !workspace.hubspotTokenExpiresAt || workspace.hubspotTokenExpiresAt < new Date();
  if (workspace.hubspotAccessToken && !expired) return workspace.hubspotAccessToken;

  const refreshed = await refreshToken(workspace.hubspotRefreshToken);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { hubspotAccessToken: refreshed.access_token, hubspotTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
  });
  return refreshed.access_token;
}

type HubspotObject = { id: string; properties: Record<string, string> };

async function hubspotFetch(accessToken: string, path: string, init?: RequestInit): Promise<HubspotObject> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`HubSpot API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<HubspotObject>;
}

// Creates the Contact on first sync, updates it on every later one —
// hubspotContactId on our Client row is the join key.
async function upsertContact(accessToken: string, client: { id: string; name: string; company: string; email: string | null; hubspotContactId: string | null }): Promise<string> {
  const properties = { email: client.email ?? undefined, firstname: client.name, company: client.company };
  if (client.hubspotContactId) {
    await hubspotFetch(accessToken, `/crm/v3/objects/contacts/${client.hubspotContactId}`, { method: "PATCH", body: JSON.stringify({ properties }) });
    return client.hubspotContactId;
  }
  const created = await hubspotFetch(accessToken, "/crm/v3/objects/contacts", { method: "POST", body: JSON.stringify({ properties }) });
  await prisma.client.update({ where: { id: client.id }, data: { hubspotContactId: created.id } });
  return created.id;
}

async function upsertDeal(
  accessToken: string,
  deal: { id: string; service: string; feeDisplay: string; status: string; hubspotDealId: string | null },
  contactId: string
): Promise<string> {
  const amount = parseFee(deal.feeDisplay);
  const properties: Record<string, string> = { dealname: deal.service || "SealMe deal", amount: String(amount) };

  let dealId: string;
  if (deal.hubspotDealId) {
    await hubspotFetch(accessToken, `/crm/v3/objects/deals/${deal.hubspotDealId}`, { method: "PATCH", body: JSON.stringify({ properties }) });
    dealId = deal.hubspotDealId;
  } else {
    const created = await hubspotFetch(accessToken, "/crm/v3/objects/deals", { method: "POST", body: JSON.stringify({ properties }) });
    dealId = created.id;
    await prisma.deal.update({ where: { id: deal.id }, data: { hubspotDealId: dealId } });
  }

  // Best-effort — a deal synced without its contact association is still
  // useful, so this failing shouldn't undo the deal/contact upserts above.
  try {
    await fetch(`https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error(`HubSpot deal-contact association failed for deal ${dealId}`, err);
  }

  return dealId;
}

// Pushes one deal (and its client, as a Contact) to HubSpot — called
// alongside dispatchWebhookEvent/notifySlack at the same event sites
// (deal.created, contract.sent, contract.signed). Never throws into the
// caller; failures are logged only, same contract as the other two.
export async function syncDealToHubspot(workspaceId: string, dealId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.hubspotEnabled || !workspace.hubspotRefreshToken) return;

  try {
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { client: true } });
    if (!deal) return;

    const accessToken = await getValidAccessToken(workspaceId);
    const contactId = await upsertContact(accessToken, deal.client);
    await upsertDeal(accessToken, deal, contactId);
  } catch (err) {
    console.error(`HubSpot sync failed for deal ${dealId}`, err);
  }
}
