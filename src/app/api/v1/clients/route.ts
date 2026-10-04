import { prisma } from "@/lib/db";
import { apiGuard, apiJson, apiError, readJsonObject } from "@/lib/api-auth";
import { serializeClient } from "@/lib/api-serialize";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const auth = await apiGuard(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");

  const clients = await prisma.client.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { id: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = clients.length > PAGE_SIZE;
  const page = hasMore ? clients.slice(0, PAGE_SIZE) : clients;

  return apiJson({ data: page.map(serializeClient), nextCursor: hasMore ? page[page.length - 1].id : null });
}

// POST /api/v1/clients — lets a customer's own CRM push a new client into
// SealMe directly, instead of someone re-typing it here first. Deliberately
// minimal (name/company/email) — a client on its own doesn't do anything
// until a deal is started against it from inside the app.
export async function POST(req: Request) {
  const auth = await apiGuard(req, { write: true });
  if (auth instanceof Response) return auth;

  const body = await readJsonObject(req);
  if (!body) return apiError(400, "The body must be a JSON object");
  const { name, company, email, billingAddress } = body;
  if (typeof name !== "string" || !name.trim()) return apiError(400, "\"name\" is required");

  const client = await prisma.client.create({
    data: {
      workspaceId: auth.workspaceId,
      name: name.trim().slice(0, 200),
      company: typeof company === "string" && company.trim() ? company.trim() : name.trim(),
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      billingAddress: typeof billingAddress === "string" && billingAddress.trim() ? billingAddress.trim() : null,
    },
  });

  return apiJson(serializeClient(client), 201);
}
