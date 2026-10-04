import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError } from "@/lib/api-auth";
import { serializeClient } from "@/lib/api-serialize";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, workspaceId: auth.workspaceId } });
  if (!client) return apiError(404, "Client not found");

  return apiJson(serializeClient(client));
}
