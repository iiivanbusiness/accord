import { prisma } from "@/lib/db";
import { apiGuard, apiJson } from "@/lib/api-auth";

// GET /api/v1/templates: the contract templates a deal can be started
// with (POST /api/v1/deals takes one's id).
export async function GET(req: Request) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;

  const templates = await prisma.contractTemplate.findMany({
    where: { workspaceId: auth.workspaceId },
    select: { id: true, name: true, description: true, locked: true },
    orderBy: { name: "asc" },
  });
  return apiJson({ data: templates.map((t) => ({ id: t.id, name: t.name, description: t.description, locked: t.locked })) });
}
