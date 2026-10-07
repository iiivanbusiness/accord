import { prisma } from "@/lib/db";

// The campaigns a workspace's leads are in so far, for suggestions and the
// filter on Leads. Most workspaces have none, and then nothing about
// campaigns shows.
export async function workspaceCampaigns(workspaceId: string): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where: { workspaceId, campaign: { not: null } },
    distinct: ["campaign"],
    select: { campaign: true },
    orderBy: { campaign: "asc" },
    take: 200,
  });
  return rows.map((r) => r.campaign).filter((c): c is string => Boolean(c));
}
