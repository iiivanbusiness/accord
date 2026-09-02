import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { computeClientRisk } from "@/lib/client-risk";
import { dealVisibilityFilter } from "@/lib/deal-visibility";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const RISK_LABEL: Record<string, string> = { high: "At risk", watch: "Watch" };
const RISK_CHIP: Record<string, string> = { high: "chip-warn", watch: "chip-neutral" };

export default async function ClientsPage() {
  const workspaceId = await requireWorkspaceId();
  const { where: visibility, canViewAll } = await dealVisibilityFilter();
  const clients = await prisma.client.findMany({
    where: { workspaceId },
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
  const withRisk = visibleClients.map((client) => ({ client, risk: computeClientRisk(client) }));

  return (
    <>
    <div className="mb-6">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Clients</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        {visibleClients.length} clients across active and past deals
      </div>
    </div>

    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {withRisk.map(({ client, risk }) => (
        <div key={client.id} className="card p-[18px]">
          <div className="mb-3 flex items-center justify-between">
            <div
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] font-display text-[14px] font-semibold"
              style={{ background: "var(--surface-2)", color: "var(--ink)" }}
            >
              {initials(client.name)}
            </div>
            {risk.level !== "none" && (
              <span className={`chip ${RISK_CHIP[risk.level]}`} title={risk.reasons.join(" · ")} style={{ fontSize: 11 }}>
                {RISK_LABEL[risk.level]}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-medium">{client.name}</h3>
          <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{client.email ?? "No email on file"}</div>
          {risk.level !== "none" && (
            <div className="mb-2.5 flex flex-col gap-0.5">
              {risk.reasons.map((reason) => (
                <div key={reason} className="text-[11.5px]" style={{ color: "var(--warn)" }}>⚠ {reason}</div>
              ))}
            </div>
          )}
          {client.deals.map((deal) => (
            <div key={deal.id} className="flex justify-between border-t py-1.5 text-[12.5px]" style={{ borderColor: "var(--hairline-soft)" }}>
              <span style={{ color: "var(--ink-muted)" }}>Deal</span>
              <span className="font-medium">{deal.service}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
    </>
  );
}
