import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError } from "@/lib/api-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deal: { workspaceId: auth.workspaceId, trashedAt: null } },
    include: { deal: { include: { client: true } } },
  });
  if (!contract) return apiError(404, "Contract not found");

  return apiJson({
    id: contract.id,
    status: contract.status,
    dealId: contract.dealId,
    client: { id: contract.deal.client.id, name: contract.deal.client.name, company: contract.deal.client.company },
    sentAt: contract.sentAt?.toISOString() ?? null,
    viewedAt: contract.viewedAt?.toISOString() ?? null,
    signedAt: contract.signedAt?.toISOString() ?? null,
    expiresAt: contract.expiresAt?.toISOString() ?? null,
    signerName: contract.signerName,
    renewalDate: contract.renewalDate?.toISOString() ?? null,
    autoRenews: contract.autoRenews,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sealme.net"}/deals/${contract.dealId}/contract`,
  });
}
