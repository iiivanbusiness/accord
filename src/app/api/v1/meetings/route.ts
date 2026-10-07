import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, readJsonObject } from "@/lib/api-auth";
import { prospectingOn } from "@/lib/api-leads";
import { bookMeeting, findApiLead, findApiRep, parseMeetingInput, serializeTask, TASK_API_SELECT } from "@/lib/api-activity";

// POST /api/v1/meetings: a meeting booked outside SealMe. It becomes a
// sales call on the rep's day (a task), the lead moves to Meeting, the rep
// is told, and meeting.booked fires. Reschedule or cancel it with
// PATCH /tasks/{id}.
export async function POST(req: Request) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, "Leads aren't turned on for this workspace");

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const parsed = parseMeetingInput(body);
  if ("error" in parsed) return apiError(400, parsed.error);
  const input = parsed.data;

  const found = await findApiLead(auth.workspaceId, body);
  if ("error" in found) return apiError(found.status, found.error);
  const who = await findApiRep(auth.workspaceId, body, found.lead.ownerId);
  if ("error" in who) return apiError(who.status, who.error);

  const duplicate = async () =>
    input.externalId ? prisma.task.findFirst({ where: { workspaceId: auth.workspaceId, externalId: input.externalId }, select: { id: true } }) : null;
  const existing = await duplicate();
  if (existing) return apiError(409, "A meeting with this externalId already exists", { existingId: existing.id });

  // The notification says who booked it: the name the key was given.
  const key = await prisma.apiKey.findUnique({ where: { id: auth.apiKeyId }, select: { name: true } });
  try {
    const taskId = await bookMeeting({ workspaceId: auth.workspaceId, lead: found.lead, rep: who.rep, input, actorName: key?.name || "Your API" });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: TASK_API_SELECT });
    return apiJson(serializeTask(task), 201);
  } catch (err) {
    if ((err as { code?: string }).code === "P2002" && input.externalId) {
      return apiError(409, "A meeting with this externalId already exists", { existingId: (await duplicate())?.id ?? null });
    }
    throw err;
  }
}
