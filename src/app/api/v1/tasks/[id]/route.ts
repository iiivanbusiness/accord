import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, readJsonObject } from "@/lib/api-auth";
import { prospectingOn } from "@/lib/api-leads";
import { findApiRep, parseTaskPatch, serializeTask, TASK_API_SELECT } from "@/lib/api-activity";
import { dispatchTasksCompleted } from "@/lib/webhook-events";

const NOT_ON = "Leads aren't turned on for this workspace";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const { id } = await params;
  const task = await prisma.task.findFirst({ where: { id, workspaceId: auth.workspaceId }, select: TASK_API_SELECT });
  if (!task) return apiError(404, "Task not found");
  return apiJson(serializeTask(task));
}

// PATCH /api/v1/tasks/{id}: move it (date, time, timeZone), hand it to
// someone else (repEmail), or close it (status done, or skipped for a
// cancelled meeting). Fires task.completed when it closes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, NOT_ON);

  const { id } = await params;
  const existing = await prisma.task.findFirst({ where: { id, workspaceId: auth.workspaceId }, select: { id: true, status: true } });
  if (!existing) return apiError(404, "Task not found");

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const parsed = parseTaskPatch(body);
  if ("error" in parsed) return apiError(400, parsed.error);
  const { status, ...rest } = parsed.data;

  // repEmail null leaves it unassigned, for a manager to hand out.
  let assigneeId: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(body, "repEmail")) {
    const who = await findApiRep(auth.workspaceId, body, null);
    if ("error" in who) return apiError(who.status, who.error);
    assigneeId = who.rep?.id ?? null;
  }
  if (Object.keys(rest).length === 0 && !status && assigneeId === undefined) return apiError(400, "Nothing to change. Send at least one field");

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(status && status !== existing.status ? { status, completedAt: status === "open" ? null : new Date() } : {}),
    },
    select: TASK_API_SELECT,
  });
  if (status && status !== "open" && existing.status === "open") await dispatchTasksCompleted(auth.workspaceId, [id]);
  return apiJson(serializeTask(task));
}
