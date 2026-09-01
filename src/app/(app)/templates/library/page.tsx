import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspaceId } from "@/lib/workspace";
import { currentUserWithRole } from "@/lib/permissions";
import ClauseLibraryManager from "@/components/ClauseLibraryManager";
import { createLibraryClause, updateLibraryClause, deleteLibraryClause } from "../library-actions";

export default async function ClauseLibraryPage() {
  const workspaceId = await requireWorkspaceId();
  const [items, user] = await Promise.all([
    prisma.clauseLibraryItem.findMany({ where: { workspaceId }, orderBy: { title: "asc" } }),
    currentUserWithRole(),
  ]);
  if (!user.role?.canApproveTemplates) redirect("/templates");

  return (
    <>
    <Link href="/templates" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Templates
    </Link>

    <div className="mb-6">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Clause library</h1>
      <div className="mt-1 text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Maintain standard wording in one place, then insert it into any template — editing a template&apos;s own copy never changes the library, and vice versa.
      </div>
    </div>

    <div className="card max-w-[600px]">
      <ClauseLibraryManager
        items={items}
        createAction={createLibraryClause}
        updateAction={updateLibraryClause}
        deleteAction={deleteLibraryClause}
      />
    </div>
    </>
  );
}
