import { createHmac } from "crypto";
import { prisma } from "@/lib/db";

// The full set of events a WebhookEndpoint can subscribe to. Kept
// deliberately small for v1 — the core "keep an external CRM in sync"
// loop (new deal, sent, signed) rather than every internal status change.
export const WEBHOOK_EVENTS = ["deal.created", "contract.sent", "contract.signed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

// Sends `event` with `data` to every enabled endpoint in this workspace
// subscribed to it. Fire-and-forget from the caller's point of view: each
// endpoint gets its own try/catch, a failure here never blocks or throws
// into whatever action triggered it (same pattern as the email-notify
// helpers in src/lib/approval.ts). One attempt only — no retry queue in
// v1, see the WebhookDelivery doc comment.
export async function dispatchWebhookEvent(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { workspaceId, enabled: true } });
  const subscribed = endpoints.filter((e) => {
    try {
      return (JSON.parse(e.events) as string[]).includes(event);
    } catch {
      return false;
    }
  });
  if (subscribed.length === 0) return;

  await Promise.all(subscribed.map((endpoint) => deliverToEndpoint(endpoint.id, endpoint.url, endpoint.secret, event, data)));
}

async function deliverToEndpoint(endpointId: string, url: string, secret: string, event: string, data: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SealMe-Signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    await prisma.webhookDelivery.create({ data: { endpointId, event, responseStatus: res.status } });
  } catch (err) {
    console.error(`Webhook delivery failed for endpoint ${endpointId}`, err);
    await prisma.webhookDelivery.create({ data: { endpointId, event, error: err instanceof Error ? err.message : "Unknown error" } }).catch(() => {});
  }
}

// Used by the Settings "Send test event" button — same signing/delivery
// path as a real event, so a green result there actually proves the
// endpoint + secret are wired up correctly.
export async function sendTestWebhook(endpointId: string): Promise<void> {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint) throw new Error("Webhook endpoint not found");
  await deliverToEndpoint(endpoint.id, endpoint.url, endpoint.secret, "test", {
    message: "This is a test event from SealMe — no real deal was created.",
  });
}
