import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, readJsonObject } from "@/lib/api-auth";
import { LEAD_API_SELECT, serializeLead } from "@/lib/api-serialize";
import { parseLeadInput, prospectingOn } from "@/lib/api-leads";

const NOT_ON = "Leads aren't turned on for this workspace";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, workspaceId: auth.workspaceId }, select: LEAD_API_SELECT });
  if (!lead) return apiError(404, "Lead not found");
  return apiJson(serializeLead(lead));
}

// PATCH /api/v1/leads/{id}: change only the fields sent; null clears one.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, workspaceId: auth.workspaceId }, select: { id: true, convertedAt: true } });
  if (!existing) return apiError(404, "Lead not found");

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const parsed = await parseLeadInput(auth.workspaceId, body, { requireName: false });
  if ("error" in parsed) return apiError(400, parsed.error);
  const data = { ...parsed.data };
  // Already converted: keep when it happened.
  if (data.convertedAt && existing.convertedAt) data.convertedAt = existing.convertedAt;
  if (Object.keys(data).length === 0) return apiError(400, "Nothing to change. Send at least one field");

  const lead = await prisma.lead.update({ where: { id }, data, select: LEAD_API_SELECT });
  return apiJson(serializeLead(lead));
}
