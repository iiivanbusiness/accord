import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError } from "@/lib/api-auth";
import { serializeDealDetail } from "@/lib/api-serialize";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId: auth.workspaceId, trashedAt: null },
    include: { client: true, contract: true, fields: true, owner: { select: { name: true, email: true } } },
  });
  if (!deal) return apiError(404, "Deal not found");

  return apiJson(serializeDealDetail(deal));
}
