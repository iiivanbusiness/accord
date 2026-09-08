import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { computeClientRisk } from "@/lib/client-risk";
import { dealVisibilityFilter } from "@/lib/deal-visibility";
import ClientsFilterBar from "@/components/ClientsFilterBar";
import ClientsTable from "@/components/ClientsTable";

const RISK_LABEL: Record<string, string> = { high: "At risk", watch: "Watch" };

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const workspaceId = await requireWorkspaceId();
  const { where: visibility, canViewAll } = await dealVisibilityFilter();

  const clients = await prisma.client.findMany({
    where: {
      workspaceId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      deals: {
        where: visibility,
        include: {
          actionItems: true,
          contract: { include: { clauseComments: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // A restricted role only sees clients it actually has a visible deal
  // with — otherwise the client list itself would leak who else the
  // workspace talks to.
  const visibleClients = canViewAll ? clients : clients.filter((c) => c.deals.length > 0);

  const rows = visibleClients.map((client) => {
    const risk = computeClientRisk(client);
    const lastActivityAt = client.deals.reduce((latest, d) => Math.max(latest, d.updatedAt.getTime()), client.createdAt.getTime());
    return {
      id: client.id,
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      dealsCount: client.deals.length,
      lastActivityAgo: timeAgo(new Date(lastActivityAt)),
      lastActivityAt,
      riskLevel: risk.level,
      riskLabel: risk.level !== "none" ? RISK_LABEL[risk.level] : null,
    };
  });

  return (
    <>
    <div className="mb-6">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Clients</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        {rows.length} {rows.length === 1 ? "client" : "clients"} across active and past deals
      </div>
    </div>

    <ClientsFilterBar />
    <ClientsTable rows={rows} />
    </>
  );
}
