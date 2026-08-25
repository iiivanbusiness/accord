import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { deleteTemplate } from "../actions";

type Clause = { title: string; body: string };

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  const template = await prisma.contractTemplate.findFirst({ where: { id, workspaceId }, include: { deals: true } });
  if (!template) notFound();

  const clauses = JSON.parse(template.clauses) as Clause[];

  return (
    <>
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

    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_260px]">
      <div className="card px-5 py-7 md:px-[46px] md:py-[42px]">
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
    </>
  );
}
