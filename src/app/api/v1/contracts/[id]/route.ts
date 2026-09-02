import { prisma } from "@/lib/db";
import { authenticateApiRequest, apiJson, apiError } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deal: { workspaceId: auth.workspaceId } },
    include: { deal: { include: { client: true } } },
  });
  if (!contract) return apiError(404, "Contract not found");

  return apiJson({
    id: contract.id,
    status: contract.status,
    dealId: contract.dealId,
    client: { id: contract.deal.client.id, name: contract.deal.client.name, company: contract.deal.client.company },
    sentAt: contract.sentAt?.toISOString() ?? null,
    signedAt: contract.signedAt?.toISOString() ?? null,
    signerName: contract.signerName,
    renewalDate: contract.renewalDate?.toISOString() ?? null,
    autoRenews: contract.autoRenews,
  });
}
