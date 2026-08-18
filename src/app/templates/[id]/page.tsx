import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { deleteTemplate } from "../actions";

type Clause = { title: string; body: string };

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({ where: { id }, include: { deals: true } });
  if (!template) notFound();

  const clauses = JSON.parse(template.clauses) as Clause[];

  return (
    <AppShell active="/templates" screenLabel="Template">
      <Link href="/templates" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Templates
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-medium" style={{ letterSpacing: "-0.6px" }}>{template.name}</h1>
          <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>{template.description}</div>
        </div>
        <span className="chip chip-neutral">{clauses.length} clauses</span>
      </div>

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "1fr 260px" }}>
        <div className="card px-[46px] py-[42px]">
          {clauses.map((clause, i) => (
            <div key={clause.title + i} className="mb-5 max-w-[64ch] last:mb-0">
              <h3 className="mb-1.5 flex gap-2 text-[14px] font-semibold">
                <span className="font-mono-tab font-normal" style={{ color: "var(--ink-muted)" }}>{i + 1}.</span>
                {clause.title}
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{clause.body}</p>
            </div>
          ))}
        </div>

        <aside className="card flex flex-col gap-2.5 p-5">
          <div className="mb-1.5 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
            Used by {template.deals.length} deal{template.deals.length === 1 ? "" : "s"}
          </div>
          <Link href={`/templates/${template.id}/edit`} className="btn btn-secondary w-full justify-center">
            Edit template
          </Link>
          <form action={deleteTemplate.bind(null, template.id)}>
            <button
              type="submit"
              disabled={template.deals.length > 0}
              className="btn btn-secondary w-full justify-center"
              style={{ color: template.deals.length > 0 ? "var(--ink-muted)" : "#ff6b57" }}
              title={template.deals.length > 0 ? "In use by a deal — can't be deleted" : undefined}
            >
              Delete template
            </button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
