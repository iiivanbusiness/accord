import { prisma } from "@/lib/db";
import { authenticateApiRequest, apiJson, apiError } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const PAGE_SIZE = 50;

function serializeClient(client: { id: string; name: string; company: string; email: string | null; billingAddress: string | null; createdAt: Date }) {
  return {
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    billingAddress: client.billingAddress,
    createdAt: client.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

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
  const auth = await authenticateApiRequest(req);
  if (!auth) return apiError(401, "Invalid or missing API key");

  const allowed = await checkRateLimit(`api:${auth.apiKeyId}`, 120, 60_000);
  if (!allowed) return apiError(429, "Rate limit exceeded — try again shortly");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }
  const { name, company, email, billingAddress } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return apiError(400, "\"name\" is required");

  const client = await prisma.client.create({
    data: {
      workspaceId: auth.workspaceId,
      name: name.trim(),
      company: typeof company === "string" && company.trim() ? company.trim() : name.trim(),
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      billingAddress: typeof billingAddress === "string" && billingAddress.trim() ? billingAddress.trim() : null,
    },
  });

  return apiJson(serializeClient(client), 201);
}
