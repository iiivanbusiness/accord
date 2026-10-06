"use server";

import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { consentFor, recordingDecision, type ConsentRule } from "@/lib/call-consent";
import { sealmeNumber } from "@/lib/telnyx";

// How long a tap on Call waits for the rep's call to reach the SealMe number.
const INTENT_MINUTES = 10;

export type CallPlan =
  // Call SealMe first, then add the client and merge.
  | { kind: "sealme"; dial: string; leadPhone: string; announce: boolean; state: string | null }
  // SealMe stays off this call: the client is dialed directly.
  | { kind: "direct"; dial: string; reason: ConsentRule | "no_sealme_number"; state: string | null }
  | { kind: "error"; error: string };

// The Call button on a lead (and in Today). When SealMe may record this
// lead, it notes that the rep is about to call them, so the call that
// reaches the SealMe number from the rep's phone in the next few minutes
// is tied to this lead; otherwise the rep just calls the client.
export async function startLeadCall(leadId: string, input: { mode?: string; templateId?: string | null } = {}): Promise<CallPlan> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  // Nobody has to say what kind of call it is: SealMe tells from the call.
  const mode = input.mode === "cold" || input.mode === "sales" ? input.mode : "auto";

  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId: workspace.id, AND: [access.where] }, select: { id: true, phone: true } });
  if (!lead) return { kind: "error", error: "Lead not found" };
  if (!lead.phone) return { kind: "error", error: "This lead has no phone number" };

  const consent = consentFor(lead.phone);
  const number = sealmeNumber();
  if (!number) return { kind: "direct", dial: lead.phone, reason: "no_sealme_number", state: consent.state };
  const { record, announce } = recordingDecision(consent.rule, workspace.allPartyStatePolicy);
  if (!record) return { kind: "direct", dial: lead.phone, reason: consent.rule, state: consent.state };

  const me = await prisma.user.findUnique({ where: { id: access.userId }, select: { phone: true } });
  if (!me?.phone) return { kind: "error", error: "Add your phone number in Settings first, so SealMe knows the call is yours" };

  let templateId: string | null = null;
  if (mode === "sales" && input.templateId) {
    const template = await prisma.contractTemplate.findFirst({ where: { id: input.templateId, workspaceId: workspace.id }, select: { id: true } });
    if (!template) return { kind: "error", error: "That template isn't in this workspace" };
    templateId = template.id;
  }

  // Only the latest tap counts.
  await prisma.callIntent.updateMany({ where: { userId: access.userId, usedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });
  await prisma.callIntent.create({
    data: { workspaceId: workspace.id, userId: access.userId, leadId: lead.id, mode, templateId, expiresAt: new Date(Date.now() + INTENT_MINUTES * 60 * 1000) },
  });
  return { kind: "sealme", dial: number, leadPhone: lead.phone, announce, state: consent.state };
}
