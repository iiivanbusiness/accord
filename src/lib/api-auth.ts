import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const KEY_PREFIX_LEN = 12; // "sk_live_" + 4 chars — enough to recognize a key in a list, not enough to authenticate with

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Returns the raw key exactly once — same one-time-reveal pattern as
// generateScimToken. Only the hash is ever stored.
export function generateApiKey(): { raw: string; prefix: string } {
  const raw = `sk_live_${randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, KEY_PREFIX_LEN) };
}

// Every public API request authenticates with one bearer token per key
// (Authorization: Bearer sk_live_...), the same shape as SCIM's bearer
// token but scoped to one ApiKey row rather than the whole workspace, so
// a leaked key can be revoked individually without rotating everyone
// else's integration too.
export async function authenticateApiRequest(req: Request): Promise<{ workspaceId: string; apiKeyId: string } | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(token) } });
  if (!key || key.revokedAt) return null;

  // Best-effort — a failure here should never block the actual request.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { workspaceId: key.workspaceId, apiKeyId: key.id };
}

export function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function apiError(status: number, message: string): Response {
  return apiJson({ error: message }, status);
}
