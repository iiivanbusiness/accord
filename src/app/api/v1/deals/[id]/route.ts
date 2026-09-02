import { prisma } from "@/lib/db";
import { authenticateApiRequest, apiJson, apiError } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

  const { id } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    include: { client: true, contract: true },
  });
  if (!deal) return apiError(404, "Deal not found");

  return apiJson({
    id: deal.id,
    status: deal.status,
    source: deal.source,
    service: deal.service,
    fee: deal.feeDisplay,
    summary: deal.summary,
    client: { id: deal.client.id, name: deal.client.name, company: deal.client.company, email: deal.client.email },
    contract: deal.contract
      ? { id: deal.contract.id, status: deal.contract.status, sentAt: deal.contract.sentAt?.toISOString() ?? null, signedAt: deal.contract.signedAt?.toISOString() ?? null }
      : null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  });
}
