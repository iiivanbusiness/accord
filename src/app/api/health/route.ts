import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health: for uptime monitors. 200 when the app can reach its
// database, 503 when it can't. Public; says nothing about any customer.
export async function GET() {
  const started = Date.now();
  let database: { ok: boolean; ms: number };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, ms: Date.now() - started };
  } catch {
    database = { ok: false, ms: Date.now() - started };
  }
  const ok = database.ok;
  return Response.json(
    { status: ok ? "ok" : "degraded", checks: { database }, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
