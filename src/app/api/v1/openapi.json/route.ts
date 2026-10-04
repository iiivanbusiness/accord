import { openApiSpec } from "@/lib/api-docs";

// GET /api/v1/openapi.json: the API described as OpenAPI 3.1. Public, no key.
export function GET() {
  return new Response(JSON.stringify(openApiSpec(), null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
