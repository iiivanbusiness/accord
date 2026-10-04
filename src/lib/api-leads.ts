import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { isLeadStage, LEAD_INTERESTS } from "@/lib/lead-stages";

// Leads are part of Prospecting, which is turned on per workspace.
export async function prospectingOn(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { prospectingEnabled: true } });
  return Boolean(ws?.prospectingEnabled);
}

type LeadInput = {
  name?: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  domain?: string | null;
  notes?: string | null;
  stage?: string;
  interest?: string | null;
  nextStep?: string | null;
  nextStepAt?: Date | null;
  ownerId?: string | null;
  convertedAt?: Date | null;
};

// Reads the lead fields a request sent. Only keys that are present are
// returned, so PATCH changes just those; null clears a field.
export async function parseLeadInput(workspaceId: string, body: Record<string, unknown>, options: { requireName: boolean }): Promise<{ data: LeadInput } | { error: string }> {
  const data: LeadInput = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const str = (k: string, max: number): string | null | undefined => {
    if (!has(k)) return undefined;
    const v = body[k];
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    return v.trim().slice(0, max) || null;
  };

  const name = str("name", 200);
  if (options.requireName && !name) return { error: "\"name\" is required" };
  if (has("name") && !name) return { error: "\"name\" can't be empty" };
  if (name) data.name = name;

  for (const [k, max] of [["company", 200], ["title", 200], ["notes", 4000], ["nextStep", 500]] as const) {
    const v = str(k, max);
    if (v !== undefined) data[k] = v;
  }

  const email = str("email", 200);
  if (email !== undefined) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "\"email\" doesn't look like an email address" };
    data.email = email?.toLowerCase() ?? null;
  }
  const phone = str("phone", 50);
  if (phone !== undefined) data.phone = phone ? (normalizePhone(phone) ?? phone) : null;
  const domain = str("domain", 200);
  if (domain !== undefined) data.domain = domain ? domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;

  if (has("stage")) {
    const stage = body.stage;
    if (typeof stage !== "string" || !isLeadStage(stage)) return { error: "\"stage\" must be one of new, contacted, interested, meeting, converted, lost" };
    data.stage = stage;
    data.convertedAt = stage === "converted" ? new Date() : null;
  }
  const interest = str("interest", 10);
  if (interest !== undefined) {
    if (interest && !(LEAD_INTERESTS as readonly string[]).includes(interest)) return { error: "\"interest\" must be cold, warm or hot" };
    data.interest = interest;
  }
  const nextStepAt = str("nextStepAt", 10);
  if (nextStepAt !== undefined) {
    if (nextStepAt && !/^\d{4}-\d{2}-\d{2}$/.test(nextStepAt)) return { error: "\"nextStepAt\" must be a date like 2026-10-31" };
    data.nextStepAt = nextStepAt ? new Date(`${nextStepAt}T00:00:00Z`) : null;
    if (data.nextStepAt && Number.isNaN(data.nextStepAt.getTime())) return { error: "\"nextStepAt\" isn't a real date" };
  }

  const ownerEmail = str("ownerEmail", 200);
  if (ownerEmail !== undefined) {
    if (!ownerEmail) data.ownerId = null;
    else {
      const owner = await prisma.user.findFirst({ where: { workspaceId, email: { equals: ownerEmail, mode: "insensitive" }, deactivatedAt: null }, select: { id: true } });
      if (!owner) return { error: "\"ownerEmail\" doesn't match anyone active in this workspace" };
      data.ownerId = owner.id;
    }
  }
  return { data };
}
