import { prisma } from "@/lib/db";
import { authenticateApiRequest, apiJson, apiError } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const PAGE_SIZE = 50;

function serializeDeal(deal: {
  id: string; service: string; feeDisplay: string; status: string; source: string;
  createdAt: Date; updatedAt: Date; client: { id: string; name: string; company: string; email: string | null };
}) {
  return {
    id: deal.id,
    status: deal.status,
    source: deal.source,
    service: deal.service,
    fee: deal.feeDisplay,
    client: { id: deal.client.id, name: deal.client.name, company: deal.client.company, email: deal.client.email },
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

// GET /api/v1/deals?status=&updatedSince=&cursor= — a workspace's own IT
// team pulling deals into their own systems (a CRM sync, a BI dashboard).
// An API key is a workspace-wide credential (no per-user identity), so
// this deliberately sees every deal, the same way SCIM does — not scoped
// by dealVisibilityFilter, which is about a person's own view inside the
// app.
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const updatedSince = url.searchParams.get("updatedSince");
  const cursor = url.searchParams.get("cursor");

  const updatedSinceDate = updatedSince ? new Date(updatedSince) : null;
  if (updatedSince && Number.isNaN(updatedSinceDate?.getTime())) {
    return apiError(400, "updatedSince must be an ISO 8601 date");
  }

  const deals = await prisma.deal.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(status ? { status } : {}),
      ...(updatedSinceDate ? { updatedAt: { gte: updatedSinceDate } } : {}),
    },
    include: { client: true },
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = deals.length > PAGE_SIZE;
  const page = hasMore ? deals.slice(0, PAGE_SIZE) : deals;

  return apiJson({
    data: page.map(serializeDeal),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
