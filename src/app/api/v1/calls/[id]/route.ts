import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError } from "@/lib/api-auth";
import { prospectingOn } from "@/lib/api-leads";
import { CALL_API_SELECT, serializeCall } from "@/lib/api-activity";

// GET /api/v1/calls/{id}: one call, with its transcript.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;
  if (!(await prospectingOn(auth.workspaceId))) return apiError(403, "Leads aren't turned on for this workspace");

  const { id } = await params;
  const call = await prisma.phoneCall.findFirst({ where: { id, workspaceId: auth.workspaceId, status: { not: "dialing" } }, select: { ...CALL_API_SELECT, transcript: true } });
  if (!call) return apiError(404, "Call not found");
  return apiJson(serializeCall(call));
}
