import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// Returns false once `max` hits have landed for `key` within `windowMs` —
// callers should treat that as "reject this attempt", and only record a hit
// when the attempt is one worth counting (e.g. don't count a signup that
// already failed validation for an unrelated reason).
//
// A plain count-then-insert has to be atomic per key, or two requests for
// the same key arriving close enough together can both read the same count
// before either writes its own hit, letting both through even when the
// second one should have been rejected. An interactive transaction plus an
// advisory lock would fix that too, but holds a pooled DB connection open
// for every caller queued on the same key — exactly the kind of burst a
// rate limiter is there to survive (a brute-force script hammering one
// login) would instead exhaust the pool for the whole app. A single
// INSERT ... ON CONFLICT DO UPDATE has no such failure mode: Postgres
// serializes concurrent upserts to the same row internally, in one
// statement, on whatever connection happens to run it — no transaction,
// no lock held across round trips.
//
// This also switches the counter from a true sliding window (count of
// individual hit rows in the last windowMs) to a fixed window that resets
// once windowStart is older than windowMs — a request right at the
// boundary can very slightly undercount, but for abuse-prevention windows
// like these the difference is immaterial, and it's what lets one row per
// key stand in for what used to be one row per hit.
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitHit"."windowStart" > ${windowCutoff} THEN "RateLimitHit"."count" + 1 ELSE 1 END,
      "windowStart" = CASE WHEN "RateLimitHit"."windowStart" > ${windowCutoff} THEN "RateLimitHit"."windowStart" ELSE ${now} END
    RETURNING "count"
  `;
  const count = rows[0]?.count ?? 1;
  return count <= max;
}

// Vercel sets x-forwarded-for on every request; falls back to "unknown" for
// local dev where it's absent, which just buckets all local traffic together.
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return store.get("x-real-ip") ?? "unknown";
}
