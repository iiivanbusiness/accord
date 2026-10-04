import { createHmac, randomBytes } from "crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkPublicHttpsUrl } from "@/lib/outbound-url";

// Everything a WebhookEndpoint can subscribe to.
export const WEBHOOK_EVENTS = [
  "deal.created",
  "contract.sent",
  "contract.viewed",
  "contract.signed",
  "contract.declined",
  "contract.expired",
  "lead.created",
  "lead.converted",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

// Wait before each retry: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h. Seven
// attempts in all, spread over about 21 hours, then the delivery is marked
// failed (it can still be re-sent by hand from Settings).
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000, 12 * 3600_000];
export const MAX_WEBHOOK_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

// While one attempt is in flight nobody else picks the delivery up.
const ATTEMPT_LEASE_MS = 2 * 60_000;

// Runs fn after the response is sent when there is a request to hang it
// on; otherwise (a script, the cron) right away.
async function soon(fn: () => Promise<unknown>): Promise<void> {
  try {
    after(fn);
  } catch {
    await fn().catch((err) => console.error("Webhook work failed", err));
  }
}

// Records `event` for every enabled endpoint in this workspace subscribed
// to it and sends it in the background. Never throws into, or slows down,
// whatever action triggered it.
export async function dispatchWebhookEvent(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  await dispatchWebhookEvents(workspaceId, event, [data]);
}

// The same for many events of one kind at once (a lead import, a CRM
// sync). The first ones go out right away; the rest are queued and the
// retry sweep sends them shortly after, so a big batch never holds up the
// request that caused it.
const SEND_NOW_LIMIT = 50;

export async function dispatchWebhookEvents(workspaceId: string, event: WebhookEvent, items: Record<string, unknown>[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({ where: { workspaceId, enabled: true }, select: { id: true, events: true } });
    const subscribed = endpoints.filter((e) => {
      try {
        return (JSON.parse(e.events) as string[]).includes(event);
      } catch {
        return false;
      }
    });
    if (subscribed.length === 0) return;

    const now = new Date();
    const rows = items.flatMap((data) => {
      const eventId = `evt_${randomBytes(12).toString("hex")}`;
      const created = new Date().toISOString();
      // timestamp duplicates created for receivers built against v1.
      const payload = JSON.stringify({ id: eventId, event, created, timestamp: created, data });
      return subscribed.map((e) => ({ endpointId: e.id, event, eventId, payload, status: "pending", nextAttemptAt: now }));
    });
    const deliveries = await prisma.webhookDelivery.createManyAndReturn({ data: rows, select: { id: true } });
    const sendNow = deliveries.slice(0, SEND_NOW_LIMIT);
    await soon(async () => {
      for (let i = 0; i < sendNow.length; i += 5) await Promise.all(sendNow.slice(i, i + 5).map((d) => attemptDelivery(d.id)));
    });
  } catch (err) {
    console.error(`Couldn't queue webhook ${event}`, err);
  }
}

type SendResult = { ok: boolean; status: number | null; error: string | null };

async function send(url: string, secret: string, payload: string, headers: Record<string, string>): Promise<SendResult> {
  const unsafe = await checkPublicHttpsUrl(url);
  if (unsafe) return { ok: false, status: null, error: unsafe };
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "SealMe-Webhooks/1.0", "X-SealMe-Signature": `sha256=${signature}`, ...headers },
      body: payload,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const ok = res.status >= 200 && res.status < 300;
    return { ok, status: res.status, error: ok ? null : res.status >= 300 && res.status < 400 ? "Redirects aren't followed. Use the final URL" : null };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, status: null, error: timedOut ? "No answer within 10 seconds" : err instanceof Error ? err.message.slice(0, 300) : "Couldn't connect" };
  }
}

// One attempt at one pending delivery. Claims it first, so a sweep and a
// fresh dispatch never send the same delivery twice at once.
export async function attemptDelivery(deliveryId: string, options: { retry?: boolean } = {}): Promise<void> {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!d || d.status !== "pending" || !d.payload) return;
  // Only a delivery that's due and not already taken: the claim pushes
  // nextAttemptAt out by the lease, so a second caller finds nothing.
  const now = new Date();
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: d.id, status: "pending", attempts: d.attempts, nextAttemptAt: { lte: now } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + ATTEMPT_LEASE_MS) },
  });
  if (claimed.count === 0) return;
  const attempt = d.attempts + 1;

  if (!d.endpoint.enabled) {
    await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "failed", nextAttemptAt: null, error: "Endpoint paused" } });
    return;
  }

  const result = await send(d.endpoint.url, d.endpoint.secret, d.payload, {
    "X-SealMe-Event": d.event,
    "X-SealMe-Event-Id": d.eventId ?? "",
    "X-SealMe-Delivery": d.id,
    "X-SealMe-Attempt": String(attempt),
  });

  const retry = options.retry !== false && !result.ok && attempt < MAX_WEBHOOK_ATTEMPTS;
  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: {
      status: result.ok ? "delivered" : retry ? "pending" : "failed",
      responseStatus: result.status,
      error: result.ok ? null : (result.error ?? `Answered ${result.status}`),
      deliveredAt: result.ok ? new Date() : null,
      nextAttemptAt: retry ? new Date(Date.now() + RETRY_DELAYS_MS[attempt - 1]) : null,
    },
  });
}

// Sends whatever retries are due. Runs from the daily cron and, at most
// once a minute, whenever someone is using the app (see
// scheduleWebhookRetries), since Vercel Hobby only allows daily crons.
export async function retryDueWebhookDeliveries(options: { limit?: number; budgetMs?: number } = {}): Promise<{ attempted: number }> {
  const deadline = Date.now() + (options.budgetMs ?? 20_000);
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() }, payload: { not: null } },
    orderBy: { nextAttemptAt: "asc" },
    take: options.limit ?? 25,
    select: { id: true },
  });
  let attempted = 0;
  for (let i = 0; i < due.length && Date.now() < deadline; i += 5) {
    await Promise.all(due.slice(i, i + 5).map((d) => attemptDelivery(d.id)));
    attempted += Math.min(5, due.length - i);
  }
  return { attempted };
}

let lastSweepStartedAt = 0;

// Cheap to call on every request: does nothing unless a minute has passed
// (per server instance, then across all of them), and the work itself
// happens after the response.
export function scheduleWebhookRetries(): void {
  if (Date.now() - lastSweepStartedAt < 60_000) return;
  lastSweepStartedAt = Date.now();
  try {
    after(async () => {
      try {
        if (!(await checkRateLimit("webhook-retry-sweep", 1, 60_000))) return;
        await retryDueWebhookDeliveries({ limit: 50, budgetMs: 25_000 });
      } catch (err) {
        console.error("Webhook retry sweep failed", err);
      }
    });
  } catch {
    // Outside a request; the cron covers it.
  }
}

// Settings "Send test": the same signing and delivery path as a real event,
// sent once and shown right away, so a green result proves the endpoint and
// secret are wired up.
export async function sendTestWebhook(endpointId: string): Promise<void> {
  const eventId = `evt_${randomBytes(12).toString("hex")}`;
  const created = new Date().toISOString();
  const payload = JSON.stringify({ id: eventId, event: "test", created, timestamp: created, data: { message: "This is a test event from SealMe. No real deal was created." } });
  const d = await prisma.webhookDelivery.create({ data: { endpointId, event: "test", eventId, payload, status: "pending", nextAttemptAt: new Date() } });
  await attemptDelivery(d.id, { retry: false });
}

// Settings "Resend": the same event (same id, so the receiver can tell it's
// a repeat) as a fresh delivery, sent now.
export async function resendWebhookDelivery(deliveryId: string): Promise<void> {
  const old = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
  if (!old.payload) throw new Error("This delivery is too old to resend");
  const d = await prisma.webhookDelivery.create({
    data: { endpointId: old.endpointId, event: old.event, eventId: old.eventId, payload: old.payload, status: "pending", nextAttemptAt: new Date() },
  });
  await attemptDelivery(d.id);
}

// What lead.created carries: who the person is, where they came from and
// who has them.
export async function leadWebhookData(workspaceId: string, leadIds: string[]): Promise<Record<string, unknown>[]> {
  if (leadIds.length === 0) return [];
  const leads = await prisma.lead.findMany({
    where: { workspaceId, id: { in: leadIds } },
    select: { id: true, name: true, company: true, title: true, email: true, phone: true, stage: true, source: true, createdAt: true, owner: { select: { name: true, email: true } } },
  });
  return leads.map((l) => ({
    leadId: l.id,
    name: l.name,
    company: l.company,
    title: l.title,
    email: l.email,
    phone: l.phone,
    stage: l.stage,
    source: l.source,
    owner: l.owner ? { name: l.owner.name, email: l.owner.email } : null,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function dispatchLeadsCreated(workspaceId: string, leadIds: string[]): Promise<void> {
  try {
    await dispatchWebhookEvents(workspaceId, "lead.created", await leadWebhookData(workspaceId, leadIds));
  } catch (err) {
    console.error("Couldn't queue lead.created", err);
  }
}
