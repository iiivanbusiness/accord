"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

type ClauseInput = { title: string; body: string };

export async function createTemplate(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const clausesRaw = String(formData.get("clausesJson") ?? "[]");

  if (!name) throw new Error("Template name is required");

  let clauses: ClauseInput[] = [];
  try {
    clauses = (JSON.parse(clausesRaw) as ClauseInput[]).filter((c) => c.title.trim() || c.body.trim());
  } catch {
    clauses = [];
  }
  if (clauses.length === 0) throw new Error("Add at least one clause");

  const placeholders = new Set<string>();
  for (const clause of clauses) {
    const matches = clause.body.matchAll(/\{(\w+)\}/g);
    for (const m of matches) placeholders.add(m[1]);
  }

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) throw new Error("No workspace found");

  const template = await prisma.contractTemplate.create({
    data: {
      workspaceId: workspace.id,
      name,
      description: description || `Custom template with ${clauses.length} clauses.`,
      requiredFieldCount: placeholders.size,
      clauses: JSON.stringify(clauses),
    },
  });

  redirect(`/templates/${template.id}`);
}

export async function deleteTemplate(templateId: string) {
  const inUse = await prisma.deal.count({ where: { templateId } });
  if (inUse > 0) {
    throw new Error("This template is used by one or more deals and can't be deleted.");
  }
  await prisma.contractTemplate.delete({ where: { id: templateId } });
  redirect("/templates");
}
