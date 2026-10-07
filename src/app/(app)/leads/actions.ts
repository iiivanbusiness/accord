"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dispatchLeadsCreated } from "@/lib/webhooks";
import { dispatchLeadsUpdated, leadChanges } from "@/lib/webhook-events";
import { requireProspecting } from "@/lib/prospecting";
import { normalizePhone } from "@/lib/phone";
import { isLeadStage, LEAD_INTERESTS } from "@/lib/lead-stages";
import { leadAccess } from "@/lib/lead-visibility";
import { currentUserWithRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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
    notes: text(formData, "notes")?.slice(0, 4000) ?? null,
    nextStep: text(formData, "nextStep"),
    nextStepAt: parseDay(text(formData, "nextStepAt")),
    campaign: text(formData, "campaign")?.slice(0, 100) ?? null,
  };
}

export async function createLead(formData: FormData) {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const fields = leadFieldsFrom(formData);
  // Only managers hand leads to someone else; a rep's new lead is theirs.
  const ownerId = access.canAssign ? await resolveOwner(workspace.id, text(formData, "ownerId")) : access.userId;

  const lead = await prisma.lead.create({
    data: { workspaceId: workspace.id, ownerId, source: "manual", ...fields },
    select: { id: true },
  });
  await dispatchLeadsCreated(workspace.id, [lead.id]);
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}?created=1`);
}

export async function updateLead(leadId: string, formData: FormData) {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  const existing = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, ...access.where } });
  if (!existing) throw new Error("Lead not found");

  const fields = leadFieldsFrom(formData);
  const ownerId = access.canAssign ? await resolveOwner(workspace.id, text(formData, "ownerId")) : existing.ownerId;
  await prisma.lead.update({ where: { id: leadId }, data: { ...fields, ownerId } });
  await dispatchLeadsUpdated(workspace.id, [leadChanges(leadId, existing, { ...fields, ownerId })]);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?saved=1`);
}

export async function setLeadStage(leadId: string, stage: string) {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!isLeadStage(stage)) throw new Error("Unknown stage");
  const before = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, ...access.where }, select: { stage: true } });
  if (!before) throw new Error("Lead not found");
  // convertedAt records the first time it became a customer (for /team);
  // moving it back out of "converted" clears it.
  const result = await prisma.lead.updateMany({
    where: { id: leadId, workspaceId: workspace.id, ...access.where },
    data: stage === "converted" ? { stage } : { stage, convertedAt: null },
  });
  if (result.count === 0) throw new Error("Lead not found");
  if (stage === "converted") {
    await prisma.lead.updateMany({ where: { id: leadId, workspaceId: workspace.id, convertedAt: null }, data: { convertedAt: new Date() } });
  }
  await dispatchLeadsUpdated(workspace.id, [leadChanges(leadId, before, { stage })]);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

// Managers only. Tasks go with the lead (cascade); its call transcripts are
// deleted too, unless the lead became a deal, where the calls are part of
// the deal's history now. A converted lead's client and deal stay.
export async function deleteLeads(leadIds: string[]): Promise<{ deleted: number }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!access.canAssign) throw new Error("Only managers can delete leads");
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { deleted: 0 };
  if (leadIds.length > 1000) throw new Error("Delete up to 1,000 leads at a time");

  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id, id: { in: leadIds.map(String) }, AND: [access.where] },
    select: { id: true },
  });
  const ids = leads.map((l) => l.id);
  if (ids.length === 0) return { deleted: 0 };

  const user = await currentUserWithRole();
  await prisma.$transaction([
    prisma.phoneCall.deleteMany({ where: { leadId: { in: ids }, dealId: null } }),
    prisma.lead.deleteMany({ where: { id: { in: ids } } }),
  ]);
  await logAudit({ workspaceId: workspace.id, actorEmail: user.email, action: "lead.deleted", targetType: "lead", targetId: ids.length === 1 ? ids[0] : undefined, metadata: { count: ids.length } });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  return { deleted: ids.length };
}

// The "Delete lead" button on a lead's own page.
export async function deleteLead(leadId: string): Promise<void> {
  await deleteLeads([leadId]);
  redirect("/leads?deleted=1");
}
