"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { normalizePhone } from "@/lib/phone";
import { isLeadStage, LEAD_INTERESTS } from "@/lib/lead-stages";

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

// Owner has to be an active member of this workspace; anything else
// (empty, someone from another workspace, a removed teammate) means
// unassigned rather than an error.
async function resolveOwner(workspaceId: string, ownerId: string | null): Promise<string | null> {
  if (!ownerId) return null;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, workspaceId, deactivatedAt: null }, select: { id: true } });
  return owner?.id ?? null;
}

// A date input gives YYYY-MM-DD. Stored at UTC midnight and always shown
// in UTC, so the day never shifts with the viewer's timezone.
function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function leadFieldsFrom(formData: FormData) {
  const name = text(formData, "name");
  if (!name) throw new Error("Add the lead's name");
  const email = text(formData, "email")?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email doesn't look right");
  const rawPhone = text(formData, "phone");
  const interest = text(formData, "interest");
  const decisionMaker = text(formData, "isDecisionMaker");
  return {
    name,
    company: text(formData, "company"),
    title: text(formData, "title"),
    email,
    phone: normalizePhone(rawPhone) ?? rawPhone,
    domain: text(formData, "domain")?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? null,
    interest: interest && (LEAD_INTERESTS as readonly string[]).includes(interest) ? interest : null,
    isDecisionMaker: decisionMaker === "yes" ? true : decisionMaker === "no" ? false : null,
    painPoints: text(formData, "painPoints"),
    objections: text(formData, "objections"),
    nextStep: text(formData, "nextStep"),
    nextStepAt: parseDay(text(formData, "nextStepAt")),
  };
}

export async function createLead(formData: FormData) {
  const workspace = await requireProspecting();
  const fields = leadFieldsFrom(formData);
  const ownerId = await resolveOwner(workspace.id, text(formData, "ownerId"));

  const lead = await prisma.lead.create({
    data: { workspaceId: workspace.id, ownerId, source: "manual", ...fields },
    select: { id: true },
  });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}?created=1`);
}

export async function updateLead(leadId: string, formData: FormData) {
  const workspace = await requireProspecting();
  const existing = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id }, select: { id: true } });
  if (!existing) throw new Error("Lead not found");

  const fields = leadFieldsFrom(formData);
  const ownerId = await resolveOwner(workspace.id, text(formData, "ownerId"));
  await prisma.lead.update({ where: { id: leadId }, data: { ...fields, ownerId } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?saved=1`);
}

export async function setLeadStage(leadId: string, stage: string) {
  const workspace = await requireProspecting();
  if (!isLeadStage(stage)) throw new Error("Unknown stage");
  const result = await prisma.lead.updateMany({ where: { id: leadId, workspaceId: workspace.id }, data: { stage } });
  if (result.count === 0) throw new Error("Lead not found");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}
