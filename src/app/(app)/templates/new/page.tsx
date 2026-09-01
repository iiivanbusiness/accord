import Link from "next/link";
import { redirect } from "next/navigation";
import ClauseEditor from "@/components/ClauseEditor";
import { currentUserWithRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createTemplate } from "../actions";

export default async function NewTemplatePage() {
  const user = await currentUserWithRole();
  if (!user.role?.canManageTemplates) redirect("/templates");
  const libraryClauses = await prisma.clauseLibraryItem.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { title: "asc" } });

  return (
    <>
    <Link href="/templates" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Templates
    </Link>

    <div className="mb-6 max-w-[560px]">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>New template</h1>
      <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Name it and define the clauses — the contract engine fills them from what a call actually covered.
      </div>
    </div>

    <form action={createTemplate} className="card flex max-w-[560px] flex-col gap-4 p-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Template name</span>
        <input name="name" required placeholder="e.g. Retainer Agreement" className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Description</span>
        <input name="description" placeholder="One line describing when to use this template" className="input" />
      </label>

      <ClauseEditor libraryClauses={libraryClauses} />

      <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
        Create template
      </button>
    </form>
    </>
  );
}
