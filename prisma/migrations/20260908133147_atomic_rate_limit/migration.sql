-- RateLimitHit changes shape from one-row-per-hit to one-row-per-key
-- (atomically upserted in place — see checkRateLimit in src/lib/rate-limit.ts).
-- The existing rows are transient abuse-tracking counters with no
-- historical value once we stop reading them in this shape, so this drops
-- and recreates the table rather than trying to migrate old rows into the
-- new one-per-key structure.
DROP TABLE "RateLimitHit";

CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);
