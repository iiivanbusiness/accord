import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";

export default async function TemplatesPage() {
  const workspaceId = await requireWorkspaceId();
  const templates = await prisma.contractTemplate.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });

  return (
    <>
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Contract templates</h1>
        <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
          The engine fills these from what your call actually covered
        </div>
      </div>
      <div className="flex gap-2.5">
        <Link href="/templates/upload" className="btn btn-secondary">
          ⭱ Upload a contract
        </Link>
        <Link href="/templates/new" className="btn btn-primary">
          + New template
        </Link>
      </div>
    </div>

    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {templates.map((tpl) => (
        <Link key={tpl.id} href={`/templates/${tpl.id}`} className="card p-[18px]" style={{ color: "inherit" }}>
          <h3 className="text-[15px] font-medium">{tpl.name}</h3>
          <div className="mb-2.5 mt-1 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>{tpl.description}</div>
          <span className="chip chip-neutral">{tpl.requiredFieldCount} required fields</span>
        </Link>
      ))}
    </div>
    </>
  );
}
