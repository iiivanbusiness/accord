import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";

export default async function TemplatesPage() {
  const templates = await prisma.contractTemplate.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell active="/templates" screenLabel="Templates">
      <div className="mb-6">
        <h1 className="text-[25px] font-bold">Contract templates</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          The engine fills these from what your call actually covered
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {templates.map((tpl) => (
          <div key={tpl.id} className="glass rounded-[14px] p-[18px]">
            <h3 className="text-[15px] font-bold">{tpl.name}</h3>
            <div className="mb-2.5 mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{tpl.description}</div>
            <span
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--glass-strong)", color: "var(--ink-muted)", borderColor: "var(--glass-border)" }}
            >
              {tpl.requiredFieldCount} required fields
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
