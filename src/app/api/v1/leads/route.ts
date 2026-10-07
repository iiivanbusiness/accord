import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, parseIsoParam, readJsonObject } from "@/lib/api-auth";
import { LEAD_API_SELECT, serializeLead } from "@/lib/api-serialize";
import { parseLeadInput, prospectingOn } from "@/lib/api-leads";
import { isLeadStage } from "@/lib/lead-stages";
import { dispatchLeadsCreated } from "@/lib/webhooks";

const PAGE_SIZE = 50;
const NOT_ON = "Leads aren't turned on for this workspace";

// GET /api/v1/leads?stage=&ownerEmail=&externalId=&campaign=&updatedSince=&cursor=
export async function GET(req: Request) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  if (stage && !isLeadStage(stage)) return apiError(400, "stage must be one of new, contacted, interested, meeting, converted, lost");
  const ownerEmail = url.searchParams.get("ownerEmail")?.trim().toLowerCase() || null;
  const externalId = url.searchParams.get("externalId")?.trim() || null;
  const campaign = url.searchParams.get("campaign")?.trim() || null;
  const cursor = url.searchParams.get("cursor");
  const since = parseIsoParam(url.searchParams.get("updatedSince"), "updatedSince");
  if ("error" in since) return apiError(400, since.error);

  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(stage ? { stage } : {}),
      ...(ownerEmail ? { owner: { email: { equals: ownerEmail, mode: "insensitive" } } } : {}),
      ...(externalId ? { externalId } : {}),
      ...(campaign ? { campaign: { equals: campaign, mode: "insensitive" } } : {}),
      ...(since.date ? { updatedAt: { gte: since.date } } : {}),
    },
    select: LEAD_API_SELECT,
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = leads.length > PAGE_SIZE;
  const page = hasMore ? leads.slice(0, PAGE_SIZE) : leads;
  return apiJson({ data: page.map(serializeLead), nextCursor: hasMore ? page[page.length - 1].id : null });
}

// POST /api/v1/leads: add a lead. A lead with the same externalId, email
// or phone already here is a 409 carrying its id, so a sync can PATCH it
// instead.
export async function POST(req: Request) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const parsed = await parseLeadInput(auth.workspaceId, body, { requireName: true });
  if ("error" in parsed) return apiError(400, parsed.error);
  const { data } = parsed;

  if (data.externalId) {
    const duplicate = await prisma.lead.findFirst({ where: { workspaceId: auth.workspaceId, externalId: data.externalId }, select: { id: true } });
    if (duplicate) return apiError(409, "A lead with this externalId already exists", { existingId: duplicate.id });
  }
  if (data.email || data.phone) {
    const duplicate = await prisma.lead.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        OR: [...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : []), ...(data.phone ? [{ phone: data.phone }] : [])],
      },
      select: { id: true },
    });
    if (duplicate) return apiError(409, "A lead with this email or phone already exists", { existingId: duplicate.id });
  }

  let lead;
  try {
    lead = await prisma.lead.create({
      data: { workspaceId: auth.workspaceId, source: "api", ...data, name: data.name as string },
      select: LEAD_API_SELECT,
    });
  } catch (err) {
    // Two requests with the same externalId at once: the second one loses.
    if ((err as { code?: string }).code === "P2002" && data.externalId) {
      const existing = await prisma.lead.findFirst({ where: { workspaceId: auth.workspaceId, externalId: data.externalId }, select: { id: true } });
      return apiError(409, "A lead with this externalId already exists", { existingId: existing?.id ?? null });
    }
    throw err;
  }
  await dispatchLeadsCreated(auth.workspaceId, [lead.id]);
  return apiJson(serializeLead(lead), 201);
}
