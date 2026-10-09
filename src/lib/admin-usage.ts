import { prisma } from "@/lib/db";
import { STT_USD_PER_MINUTE } from "@/lib/call-inbox";

// What testers have used, for the platform admin: calls written up (notes),
// minutes transcribed and what that cost us (transcription, models and
// Telnyx), per workspace or per person.
export type Usage = { calls: number; notes: number; sttSeconds: number; costUsd: number };

export const NO_USAGE: Usage = { calls: 0, notes: 0, sttSeconds: 0, costUsd: 0 };

// Made-up people: the demo reps in a workspace (@example.com) and the
// disposable test accounts (@example.test). Left out so the numbers are
// real testers only.
const TEST_DOMAINS = ["@example.com", "@example.test"];

export function isTestEmail(email: string): boolean {
  return TEST_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

export const NOT_TEST_EMAIL = TEST_DOMAINS.map((d) => ({ email: { endsWith: d } }));

type Sums = { _count: { _all: number; notes: number }; _sum: { sttSeconds: number | null; aiCostUsd: number | null; telnyxCostUsd: number | null } };

export function usageFrom(row: Sums): Usage {
  const sttSeconds = row._sum.sttSeconds ?? 0;
  return {
    calls: row._count._all,
    notes: row._count.notes,
    sttSeconds,
    costUsd: (sttSeconds / 60) * STT_USD_PER_MINUTE + (row._sum.aiCostUsd ?? 0) + (row._sum.telnyxCostUsd ?? 0),
  };
}

export async function usageBy(field: "workspaceId" | "userId", since?: Date): Promise<Map<string, Usage>> {
  const rows = await prisma.phoneCall.groupBy({
    by: [field],
    where: {
      status: "processed",
      ...(since ? { processedAt: { gte: since } } : {}),
      // A call with no rep (logged through the API) still counts.
      NOT: NOT_TEST_EMAIL.map((e) => ({ user: e })),
    },
    _count: { _all: true, notes: true },
    _sum: { sttSeconds: true, aiCostUsd: true, telnyxCostUsd: true },
  });
  const map = new Map<string, Usage>();
  for (const row of rows) {
    const key = row[field];
    if (key) map.set(key, usageFrom(row));
  }
  return map;
}

export function totalUsage(map: Map<string, Usage>): Usage {
  const total = { ...NO_USAGE };
  for (const u of map.values()) {
    total.calls += u.calls;
    total.notes += u.notes;
    total.sttSeconds += u.sttSeconds;
    total.costUsd += u.costUsd;
  }
  return total;
}

export function formatMinutes(seconds: number): string {
  const minutes = seconds / 60;
  if (minutes === 0) return "0";
  if (minutes < 10) return minutes.toFixed(1);
  return Math.round(minutes).toLocaleString("en-US");
}

export function formatUsd(usd: number): string {
  return usd < 100 ? `$${usd.toFixed(2)}` : `$${Math.round(usd).toLocaleString("en-US")}`;
}
