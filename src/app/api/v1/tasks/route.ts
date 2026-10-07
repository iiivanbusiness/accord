import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, parseIsoParam } from "@/lib/api-auth";
import { prospectingOn } from "@/lib/api-leads";
import { serializeTask, TASK_API_SELECT } from "@/lib/api-activity";
import { TASK_TYPES } from "@/lib/tasks";

const PAGE_SIZE = 50;

// GET /api/v1/tasks?status=&type=&assigneeEmail=&leadId=&leadExternalId=&externalId=&updatedSince=&cursor=
export async function GET(req: Request) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, "Leads aren't turned on for this workspace");

  const url = new URL(req.url);
  const param = (k: string) => url.searchParams.get(k)?.trim() || null;
  const status = param("status");
  if (status && !["open", "done", "skipped"].includes(status)) return apiError(400, "status must be open, done or skipped");
  const type = param("type");
  if (type && !(TASK_TYPES as readonly string[]).includes(type)) return apiError(400, `type must be one of ${TASK_TYPES.join(", ")}`);
  const since = parseIsoParam(url.searchParams.get("updatedSince"), "updatedSince");
  if ("error" in since) return apiError(400, since.error);
  const assigneeEmail = param("assigneeEmail");
  const leadExternalId = param("leadExternalId");
  const cursor = param("cursor");

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(assigneeEmail ? { assignee: { email: { equals: assigneeEmail, mode: "insensitive" } } } : {}),
      ...(param("leadId") ? { leadId: param("leadId") } : {}),
      ...(leadExternalId ? { lead: { externalId: leadExternalId } } : {}),
      ...(param("externalId") ? { externalId: param("externalId") } : {}),
      ...(since.date ? { updatedAt: { gte: since.date } } : {}),
    },
    select: TASK_API_SELECT,
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = tasks.length > PAGE_SIZE;
  const page = hasMore ? tasks.slice(0, PAGE_SIZE) : tasks;
  return apiJson({ data: page.map(serializeTask), nextCursor: hasMore ? page[page.length - 1].id : null });
}
