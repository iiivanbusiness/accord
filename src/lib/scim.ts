import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export function hashScimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Every SCIM request authenticates with one bearer token per workspace
// (the shape Okta/Azure AD's "app integration" model expects — one token,
// one base URL, no tenant slug in the path) rather than a token scoped to
// a specific admin user.
export async function authenticateScimRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  return prisma.workspace.findUnique({ where: { scimTokenHash: hashScimToken(token) } });
}

export function scimError(status: number, detail: string) {
  return new Response(
    JSON.stringify({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(status), detail }),
    { status, headers: { "Content-Type": "application/scim+json" } }
  );
}

export function scimJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/scim+json" } });
}

export function toScimUser(user: User, baseUrl: string) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.id,
    externalId: user.scimExternalId ?? undefined,
    userName: user.email,
    name: { formatted: user.name },
    displayName: user.name,
    emails: [{ value: user.email, primary: true }],
    active: !user.deactivatedAt,
    meta: {
      resourceType: "User",
      created: user.createdAt.toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${user.id}`,
    },
  };
}

export function scimListResponse(resources: unknown[], totalResults: number, startIndex: number) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

// Okta/Azure both send a filter like `userName eq "person@company.com"` —
// this is deliberately narrow (only that one operator, on that one field)
// rather than a general SCIM filter parser, since that's the only shape
// either actually sends for a User resource.
export function parseUserNameEqFilter(filter: string | null): string | null {
  if (!filter) return null;
  const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  return match ? match[1] : null;
}
