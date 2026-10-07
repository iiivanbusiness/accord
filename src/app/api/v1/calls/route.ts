import { after } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, parseIsoParam, readJsonObject } from "@/lib/api-auth";
import { prospectingOn } from "@/lib/api-leads";
import { CALL_API_SELECT, findApiLead, findApiRep, logCallOutcome, parseCallInput, serializeCall } from "@/lib/api-activity";
import { runCallProcessing } from "@/lib/call-inbox";
import { isExtractionConfigured } from "@/lib/extract-deal";
import { isValidTimeZone } from "@/lib/tasks";

// Writing a call up (transcribing, the notes, a deal for a sales call) runs
// after the answer and can take a minute.
export const maxDuration = 300;

const PAGE_SIZE = 50;
const NOT_ON = "Leads aren't turned on for this workspace";
const STATUSES = ["processing", "processed", "skipped", "failed", "pending", "recording", "discarded"];

// GET /api/v1/calls?leadId=&leadExternalId=&externalId=&status=&updatedSince=&cursor=
export async function GET(req: Request) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const url = new URL(req.url);
  const param = (k: string) => url.searchParams.get(k)?.trim() || null;
  const status = param("status");
  if (status && !STATUSES.includes(status)) return apiError(400, `status must be one of ${STATUSES.join(", ")}`);
  const since = parseIsoParam(url.searchParams.get("updatedSince"), "updatedSince");
  if ("error" in since) return apiError(400, since.error);
  const leadExternalId = param("leadExternalId");
  const cursor = param("cursor");

  const calls = await prisma.phoneCall.findMany({
    where: {
      workspaceId: auth.workspaceId,
      // Calls SealMe is still placing aren't anything yet.
      status: status ?? { not: "dialing" },
      ...(param("leadId") ? { leadId: param("leadId") } : {}),
      ...(leadExternalId ? { lead: { externalId: leadExternalId } } : {}),
      ...(param("externalId") ? { externalId: param("externalId") } : {}),
      ...(since.date ? { updatedAt: { gte: since.date } } : {}),
    },
    select: CALL_API_SELECT,
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = calls.length > PAGE_SIZE;
  const page = hasMore ? calls.slice(0, PAGE_SIZE) : calls;
  return apiJson({ data: page.map(serializeCall), nextCursor: hasMore ? page[page.length - 1].id : null });
}

// POST /api/v1/calls: a call made in another dialer. With just an outcome
// it's saved right away (201). With a transcript or a recording link
// SealMe writes it up like one of its own calls: the answer is 202 with
// status "processing", and call.completed fires once it's done.
export async function POST(req: Request) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const parsed = parseCallInput(body);
  if ("error" in parsed) return apiError(400, parsed.error);
  const input = parsed.data;

  const found = await findApiLead(auth.workspaceId, body);
  if ("error" in found) return apiError(found.status, found.error);
  const { lead } = found;
  const who = await findApiRep(auth.workspaceId, body, lead.ownerId);
  if ("error" in who) return apiError(who.status, who.error);
  const { rep } = who;

  if (input.externalId) {
    const existing = await prisma.phoneCall.findFirst({ where: { workspaceId: auth.workspaceId, externalId: input.externalId }, select: { id: true } });
    if (existing) return apiError(409, "A call with this externalId already exists", { existingId: existing.id });
  }

  try {
    if (!input.transcript && !input.recordingUrl) {
      const callId = await logCallOutcome({ workspaceId: auth.workspaceId, lead, repId: rep?.id ?? null, input: { ...input, outcome: input.outcome! } });
      const call = await prisma.phoneCall.findUniqueOrThrow({ where: { id: callId }, select: CALL_API_SELECT });
      return apiJson(serializeCall(call), 201);
    }

    if (!isExtractionConfigured()) return apiError(503, "Call processing isn't available right now. Send just the outcome, or try again later");
    if (input.recordingUrl && !process.env.DEEPGRAM_API_KEY) return apiError(503, "Transcribing recordings isn't available right now. Send the transcript instead");
    const call = await prisma.phoneCall.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: rep?.id ?? null,
        leadId: lead.id,
        source: "api",
        // Without a kind SealMe sorts it into cold or sales from what was said.
        mode: input.kind ?? "auto",
        status: "processing",
        transcript: input.transcript,
        recordingUrl: input.transcript ? null : input.recordingUrl,
        toNumber: input.toNumber ?? lead.phone,
        durationSec: input.durationSec,
        startedAt: input.startedAt,
        endedAt: input.durationSec !== null ? new Date(input.startedAt.getTime() + input.durationSec * 1000) : null,
        externalId: input.externalId,
      },
      select: CALL_API_SELECT,
    });
    const tz = rep?.timezone && isValidTimeZone(rep.timezone) ? rep.timezone : "America/New_York";
    after(() => runCallProcessing(call.id, tz, { auto: true }));
    return apiJson(serializeCall(call), 202);
  } catch (err) {
    // Two requests with the same externalId at once: the second one loses.
    if ((err as { code?: string }).code === "P2002" && input.externalId) {
      const existing = await prisma.phoneCall.findFirst({ where: { workspaceId: auth.workspaceId, externalId: input.externalId }, select: { id: true } });
      return apiError(409, "A call with this externalId already exists", { existingId: existing?.id ?? null });
    }
    throw err;
  }
}
