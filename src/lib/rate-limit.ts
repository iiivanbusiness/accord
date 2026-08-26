import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// Returns false once `max` hits have landed for `key` within `windowMs` —
// callers should treat that as "reject this attempt", and only record a hit
// when the attempt is one worth counting (e.g. don't count a signup that
// already failed validation for an unrelated reason).
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) return false;
  await prisma.rateLimitHit.create({ data: { key } });
  return true;
}

// Vercel sets x-forwarded-for on every request; falls back to "unknown" for
// local dev where it's absent, which just buckets all local traffic together.
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return store.get("x-real-ip") ?? "unknown";
}
