import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ include: { deals: true }, orderBy: { name: "asc" } });

  return (
    <AppShell active="/clients" screenLabel="Clients">
      <div className="mb-6">
        <h1 className="text-[25px] font-bold">Clients</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          {clients.length} clients across active and past deals
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {clients.map((client) => (
          <div key={client.id} className="glass rounded-[14px] p-[18px]">
            <div
              className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border font-display text-[14px] font-bold"
              style={{ background: "var(--glass-strong)", color: "var(--accent)", borderColor: "var(--glass-border)" }}
            >
              {initials(client.name)}
            </div>
            <h3 className="text-[15px] font-bold">{client.name}</h3>
            <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{client.email ?? "No email on file"}</div>
            {client.deals.map((deal) => (
              <div key={deal.id} className="flex justify-between border-t py-1.5 text-[12.5px]" style={{ borderColor: "var(--glass-border-soft)" }}>
                <span style={{ color: "var(--ink-faint)" }}>Deal</span>
                <span className="font-semibold">{deal.service}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
