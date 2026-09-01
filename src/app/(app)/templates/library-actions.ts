"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

// Same tier as locking a template — this is "legal maintains the canonical
// wording" territory, not general template authoring.
export async function createLibraryClause(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) throw new Error("Title is required");
  if (!body) throw new Error("Clause text is required");

  const user = await requirePermission("canApproveTemplates");
  await prisma.clauseLibraryItem.create({ data: { workspaceId: user.workspaceId, title, body } });

  revalidatePath("/templates/library");
}

export async function updateLibraryClause(itemId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) throw new Error("Title is required");
  if (!body) throw new Error("Clause text is required");

  const user = await requirePermission("canApproveTemplates");
  await prisma.clauseLibraryItem.updateMany({
    where: { id: itemId, workspaceId: user.workspaceId },
    data: { title, body },
  });

  revalidatePath("/templates/library");
}

export async function deleteLibraryClause(itemId: string) {
  const user = await requirePermission("canApproveTemplates");
  await prisma.clauseLibraryItem.deleteMany({ where: { id: itemId, workspaceId: user.workspaceId } });

  revalidatePath("/templates/library");
}
