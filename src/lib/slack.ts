import { prisma } from "@/lib/db";

// One SealMe-owned Slack app, installed per-workspace via OAuth — not a
// per-workspace app registration like SSO's ssoClientId/Secret. channels:join
// lets a newly-picked public channel be joined automatically instead of
// erring "not_in_channel" the first time a message is posted.
const SCOPES = "chat:write,channels:read,channels:join";

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/slack/callback`;
}

export function buildSlackAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    scope: SCOPES,
    redirect_uri: redirectUri(),
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

type SlackOAuthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
};

export async function exchangeSlackCode(code: string): Promise<{ accessToken: string; teamId: string; teamName: string }> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
    }),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!res.ok || !data.ok || !data.access_token || !data.team) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? res.status}`);
  }
  return { accessToken: data.access_token, teamId: data.team.id, teamName: data.team.name };
}

export type SlackChannel = { id: string; name: string };

export async function listSlackChannels(accessToken: string): Promise<SlackChannel[]> {
  const res = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=200", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { ok: boolean; error?: string; channels?: { id: string; name: string }[] };
  if (!data.ok) throw new Error(`Couldn't list Slack channels: ${data.error}`);
  return (data.channels ?? []).map((c) => ({ id: c.id, name: c.name }));
}

// Called once when a channel is picked in Settings — joins the bot to it
// so the first real notification doesn't fail with "not_in_channel".
// Already-a-member is a benign no-op on Slack's side.
export async function joinSlackChannel(accessToken: string, channelId: string): Promise<void> {
  await fetch("https://slack.com/api/conversations.join", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId }),
  });
}

async function postMessage(accessToken: string, channelId: string, text: string): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId, text, unfurl_links: false }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) console.error(`Slack message failed for channel ${channelId}:`, data.error);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export type SlackNotifyEvent =
  | { type: "deal.created"; dealId: string; clientName: string; service: string }
  | { type: "contract.sent"; dealId: string; clientName: string }
  | { type: "contract.signed"; dealId: string; clientName: string; signerName: string }
  | { type: "approval.requested"; dealId: string; clientName: string; roleName: string };

function formatMessage(event: SlackNotifyEvent): string {
  const dealUrl = `${appUrl()}/deals/${event.dealId}`;
  switch (event.type) {
    case "deal.created":
      return `📄 New deal — *${event.clientName}* (${event.service || "no service set yet"}) <${dealUrl}|View>`;
    case "contract.sent":
      return `📤 Contract sent to *${event.clientName}* <${dealUrl}/contract|View>`;
    case "contract.signed":
      return `✅ *${event.clientName}* signed — by ${event.signerName} <${dealUrl}/contract|View>`;
    case "approval.requested":
      return `⏳ Approval needed from *${event.roleName}* for *${event.clientName}* <${dealUrl}/contract|Review>`;
  }
}

// Posts to the workspace's connected Slack channel if Slack is enabled —
// same "never block the caller" contract as dispatchWebhookEvent, called
// alongside it at the same event sites.
export async function notifySlack(workspaceId: string, event: SlackNotifyEvent): Promise<void> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.slackEnabled || !workspace.slackAccessToken || !workspace.slackChannelId) return;

  try {
    await postMessage(workspace.slackAccessToken, workspace.slackChannelId, formatMessage(event));
  } catch (err) {
    console.error(`Slack notification failed for workspace ${workspaceId}`, err);
  }
}
