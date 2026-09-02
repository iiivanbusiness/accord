import { prisma } from "@/lib/db";
import { authenticateApiRequest, apiJson, apiError } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, workspaceId: auth.workspaceId } });
  if (!client) return apiError(404, "Client not found");

  return apiJson({
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    billingAddress: client.billingAddress,
    createdAt: client.createdAt.toISOString(),
  });
}
