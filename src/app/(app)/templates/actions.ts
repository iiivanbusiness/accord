"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { extractText, splitIntoClauses } from "@/lib/parse-document";
import { requireWorkspaceId } from "@/lib/workspace";

type ClauseInput = { title: string; body: string };

function countPlaceholders(clauses: ClauseInput[]): number {
  const placeholders = new Set<string>();
  for (const clause of clauses) {
    for (const m of clause.body.matchAll(/\{(\w+)\}/g)) placeholders.add(m[1]);
  }
  return placeholders.size;
}

function parseClausesJson(raw: string): ClauseInput[] {
  try {
    return (JSON.parse(raw) as ClauseInput[]).filter((c) => c.title.trim() || c.body.trim());
  } catch {
    return [];
  }
}

export async function createTemplate(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const clauses = parseClausesJson(String(formData.get("clausesJson") ?? "[]"));

  if (!name) throw new Error("Template name is required");
  if (clauses.length === 0) throw new Error("Add at least one clause");

  const workspaceId = await requireWorkspaceId();

  const template = await prisma.contractTemplate.create({
    data: {
      workspaceId,
      name,
      description: description || `Custom template with ${clauses.length} clauses.`,
      requiredFieldCount: countPlaceholders(clauses),
      clauses: JSON.stringify(clauses),
    },
  });

  redirect(`/templates/${template.id}`);
}

export async function createTemplateFromDocument(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!name) throw new Error("Template name is required");
  if (!file || file.size === 0) throw new Error("Choose a file to upload");

  const text = await extractText(file);
  const clauses = splitIntoClauses(text);

  const workspaceId = await requireWorkspaceId();

  const template = await prisma.contractTemplate.create({
    data: {
      workspaceId,
      name,
      description: `Imported from ${file.name}. Review the clauses and add {placeholder} fields where terms should be filled in automatically.`,
      requiredFieldCount: countPlaceholders(clauses),
      clauses: JSON.stringify(clauses),
    },
  });

  redirect(`/templates/${template.id}/edit`);
}

export async function updateTemplate(templateId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const clauses = parseClausesJson(String(formData.get("clausesJson") ?? "[]"));

  if (!name) throw new Error("Template name is required");
  if (clauses.length === 0) throw new Error("Add at least one clause");

  const workspaceId = await requireWorkspaceId();

  await prisma.contractTemplate.updateMany({
    where: { id: templateId, workspaceId },
    data: {
      name,
      description,
      requiredFieldCount: countPlaceholders(clauses),
      clauses: JSON.stringify(clauses),
    },
  });

  redirect(`/templates/${templateId}`);
}

export async function deleteTemplate(templateId: string) {
  const workspaceId = await requireWorkspaceId();
  const inUse = await prisma.deal.count({ where: { templateId } });
  if (inUse > 0) {
    throw new Error("This template is used by one or more deals and can't be deleted.");
  }
  await prisma.contractTemplate.deleteMany({ where: { id: templateId, workspaceId } });
  redirect("/templates");
}
