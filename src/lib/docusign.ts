import { prisma } from "@/lib/db";

// A per-workspace OAuth connection to the WORKSPACE'S OWN DocuSign
// account — not a SealMe-owned shared app the way Slack is. "Send to
// client" can hand the generated contract straight to DocuSign's own
// envelope/signing flow instead of SealMe's built-in one, for workspaces
// that already run DocuSign and don't want a second signing tool. Uses
// the sandbox ("demo") environment by default — DOCUSIGN_ENV=production
// switches every URL below to the real one once a workspace is ready to
// go live on their paid DocuSign plan.

function isProduction(): boolean {
  return process.env.DOCUSIGN_ENV === "production";
}

function authBaseUrl(): string {
  return isProduction() ? "https://account.docusign.com" : "https://account-d.docusign.com";
}

export function isDocusignConfigured(): boolean {
  return Boolean(process.env.DOCUSIGN_CLIENT_ID && process.env.DOCUSIGN_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/docusign/callback`;
}

export function buildDocusignAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    scope: "signature",
    client_id: process.env.DOCUSIGN_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
  });
  return `${authBaseUrl()}/oauth/auth?${params.toString()}`;
}

type DocusignTokenResponse = { access_token: string; refresh_token: string; expires_in: number };
type DocusignAccount = { account_id: string; is_default: boolean; account_name: string; base_uri: string };
type DocusignUserInfo = { sub: string; name: string; email: string; accounts: DocusignAccount[] };

function basicAuthHeader(): string {
  const raw = `${process.env.DOCUSIGN_CLIENT_ID ?? ""}:${process.env.DOCUSIGN_CLIENT_SECRET ?? ""}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function requestToken(body: URLSearchParams): Promise<DocusignTokenResponse> {
  const res = await fetch(`${authBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
    body,
  });
  if (!res.ok) throw new Error(`DocuSign token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<DocusignTokenResponse>;
}

async function fetchUserInfo(accessToken: string): Promise<DocusignUserInfo> {
  const res = await fetch(`${authBaseUrl()}/oauth/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Couldn't read DocuSign user info: ${res.status}`);
  return res.json() as Promise<DocusignUserInfo>;
}

export async function exchangeDocusignCode(code: string): Promise<{
  accessToken: string; refreshToken: string; expiresIn: number; accountId: string; baseUri: string; accountEmail: string;
}> {
  const tokens = await requestToken(new URLSearchParams({ grant_type: "authorization_code", code }));
  const info = await fetchUserInfo(tokens.access_token);
  const account = info.accounts.find((a) => a.is_default) ?? info.accounts[0];
  if (!account) throw new Error("DocuSign didn't return an account to connect");

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    accountId: account.account_id,
    // base_uri comes back host-only (e.g. https://demo.docusign.net) — every API call needs it prefixed to /restapi.
    baseUri: `${account.base_uri}/restapi`,
    accountEmail: info.email,
  };
}

// Returns a live access token, refreshing first if it's missing/expired —
// same pattern as google-calendar.ts and the pre-migration HubSpot OAuth.
async function getValidAccessToken(workspaceId: string): Promise<{ accessToken: string; baseUri: string; accountId: string }> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.docusignRefreshToken || !workspace.docusignBaseUri || !workspace.docusignAccountId) {
    throw new Error("DocuSign isn't connected for this workspace");
  }

  const expired = !workspace.docusignTokenExpiresAt || workspace.docusignTokenExpiresAt < new Date();
  if (workspace.docusignAccessToken && !expired) {
    return { accessToken: workspace.docusignAccessToken, baseUri: workspace.docusignBaseUri, accountId: workspace.docusignAccountId };
  }

  const refreshed = await requestToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: workspace.docusignRefreshToken }));
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { docusignAccessToken: refreshed.access_token, docusignTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
  });
  return { accessToken: refreshed.access_token, baseUri: workspace.docusignBaseUri, accountId: workspace.docusignAccountId };
}

export type EnvelopeSigner = { name: string; email: string; routingOrder: number; anchor: string };

// Creates and immediately sends a DocuSign envelope for one contract PDF.
// Each signer gets a signHere tab placed wherever their anchor string
// appears in the PDF text (see contract-pdf.tsx's docusignAnchors prop) —
// anchor-based placement means we never have to compute absolute x/y
// coordinates ourselves, DocuSign finds the text and places the tab
// relative to it.
export async function sendDocusignEnvelope(
  workspaceId: string,
  opts: { pdfBuffer: Buffer; emailSubject: string; emailBlurb: string; signers: EnvelopeSigner[] }
): Promise<string> {
  const { accessToken, baseUri, accountId } = await getValidAccessToken(workspaceId);

  const body = {
    emailSubject: opts.emailSubject,
    emailBlurb: opts.emailBlurb,
    documents: [{ documentBase64: opts.pdfBuffer.toString("base64"), name: "Contract.pdf", fileExtension: "pdf", documentId: "1" }],
    recipients: {
      signers: opts.signers.map((s, i) => ({
        email: s.email,
        name: s.name,
        recipientId: String(i + 1),
        routingOrder: String(s.routingOrder),
        tabs: { signHereTabs: [{ anchorString: s.anchor, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-10" }] },
      })),
    },
    status: "sent",
  };

  const res = await fetch(`${baseUri}/v2.1/accounts/${accountId}/envelopes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DocuSign envelope creation failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { envelopeId: string };
  return data.envelopeId;
}

// Registers a Connect webhook subscription so DocuSign notifies us when
// an envelope this workspace sent is completed — called once, right
// after a workspace connects. Best-effort: a workspace can still send
// envelopes without this, they just won't auto-complete on our side
// (someone would have to check DocuSign directly) until it succeeds.
export async function createConnectSubscription(workspaceId: string): Promise<void> {
  const { accessToken, baseUri, accountId } = await getValidAccessToken(workspaceId);
  const hmacKey = process.env.DOCUSIGN_CONNECT_HMAC_KEY;
  if (!hmacKey) return;

  const body = {
    configurationType: "custom",
    urlToPublishTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/docusign/webhook`,
    enableLog: "true",
    requiresAcknowledgement: "true",
    signMessageWithX509Cert: "false",
    useSoapInterface: "false",
    includeDocuments: "false",
    envelopeEvents: [{ envelopeEventStatusCode: "completed" }],
    eventData: { version: "restv2.1", format: "json" },
    hmac: { hmacSignatures: [{ key: hmacKey, secretKey: hmacKey, algorithmName: "SHA256" }] },
  };

  const res = await fetch(`${baseUri}/v2.1/accounts/${accountId}/connect`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`DocuSign Connect subscription failed for workspace ${workspaceId}: ${res.status} ${await res.text()}`);
}
