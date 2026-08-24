import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ClauseEditor from "@/components/ClauseEditor";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { updateTemplate } from "../../actions";

type Clause = { title: string; body: string };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  const template = await prisma.contractTemplate.findFirst({ where: { id, workspaceId } });
  if (!template) notFound();

  const clauses = JSON.parse(template.clauses) as Clause[];

  return (
    <AppShell active="/templates" screenLabel="Edit template">
      <Link href={`/templates/${template.id}`} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← {template.name}
      </Link>

      <div className="mb-6 max-w-[560px]">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Edit template</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Add {"{fieldKey}"} placeholders anywhere you want deal terms filled in automatically.
        </div>
      </div>

      <form action={updateTemplate.bind(null, template.id)} className="card flex max-w-[560px] flex-col gap-4 p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Template name</span>
          <input name="name" required defaultValue={template.name} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Description</span>
          <input name="description" defaultValue={template.description} className="input" />
        </label>

        <ClauseEditor initialClauses={clauses} />

        <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
          Save changes
        </button>
      </form>
    </AppShell>
  );
}
