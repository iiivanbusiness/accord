import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { scheduleWebhookRetries } from "@/lib/webhooks";

const KEY_PREFIX_LEN = 12; // "sk_live_" + 4 chars — enough to recognize a key in a list, not enough to authenticate with

export const API_KEY_ACCESS = ["read", "read_write"] as const;
export type ApiKeyAccess = (typeof API_KEY_ACCESS)[number];

// Requests per key per minute.
export const API_RATE_LIMIT = 120;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Returns the raw key exactly once — same one-time-reveal pattern as
// generateScimToken. Only the hash is ever stored.
export function generateApiKey(): { raw: string; prefix: string } {
  const raw = `sk_live_${randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, KEY_PREFIX_LEN) };
}

export type ApiContext = { workspaceId: string; apiKeyId: string; access: ApiKeyAccess };

// Every public API request authenticates with one bearer token per key
// (Authorization: Bearer sk_live_...), the same shape as SCIM's bearer
// token but scoped to one ApiKey row rather than the whole workspace, so
// a leaked key can be revoked individually without rotating everyone
// else's integration too.
export async function authenticateApiRequest(req: Request): Promise<ApiContext | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(token) } });
  if (!key || key.revokedAt) return null;

  // Best-effort — a failure here should never block the actual request.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  scheduleWebhookRetries();
  return { workspaceId: key.workspaceId, apiKeyId: key.id, access: key.access === "read" ? "read" : "read_write" };
}

// The checks every endpoint starts with: a valid key, under the rate limit,
// and allowed to write when the endpoint changes something. Returns the
// error response to send back, or who's calling.
export async function apiGuard(req: Request, options: { write?: boolean } = {}): Promise<ApiContext | Response> {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");
  if (!(await checkRateLimit(`api:${auth.apiKeyId}`, API_RATE_LIMIT, 60_000))) {
    return apiJson({ error: "Rate limit exceeded. Try again in a minute" }, 429, { "Retry-After": "60" });
  }
  if (options.write && auth.access !== "read_write") return apiError(403, "This API key can only read. Make a read-and-write key in Settings → API & webhooks");
  return auth;
}

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export function apiError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return apiJson({ error: message, ...extra }, status);
}

// The JSON body as an object, or null when it isn't one.
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ISO 8601 query parameter, or an error message.
export function parseIsoParam(value: string | null, name: string): { date: Date | null } | { error: string } {
  if (!value) return { date: null };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { error: `${name} must be an ISO 8601 date` } : { date };
}
