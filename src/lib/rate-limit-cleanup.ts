import { prisma } from "@/lib/db";

// RateLimitHit is one row per distinct key ever rate-limited (see
// checkRateLimit), not one row per hit, so this table is already far
// smaller than the old one-row-per-hit design — but a key nobody has hit
// again still sits there forever otherwise. Every window used anywhere in
// the app tops out at 1 hour (see call sites), so a row whose windowStart
// is older than that is dead weight; this keeps a day's buffer on top in
// case a longer window gets added later without anyone remembering to
// bump this too.
const RETENTION_MS = 24 * 60 * 60 * 1000;

export async function cleanupRateLimitHits(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const result = await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return { deleted: result.count };
}
