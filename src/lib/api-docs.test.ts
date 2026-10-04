import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENDPOINTS, EVENTS, EXAMPLES, openApiSpec, type SchemaName } from "./api-docs";
import { WEBHOOK_EVENTS } from "./webhooks";

// Every route.ts under src/app/api/v1, as "/deals/{id}"-style paths.
function routePaths(dir = path.join(__dirname, "../app/api/v1"), prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) return name === "route.ts" ? [prefix || "/"] : [];
    const segment = name.startsWith("[") ? `{${name.slice(1, -1)}}` : name;
    return routePaths(full, `${prefix}/${segment}`);
  });
}

describe("API docs", () => {
  it("document every route, and only real ones", () => {
    const documented = new Set(ENDPOINTS.map((e) => e.path));
    const real = routePaths().filter((p) => p !== "/openapi.json");
    expect([...documented].sort()).toEqual([...new Set(real)].sort());
  });
  it("document every webhook event", () => {
    expect(EVENTS.map((e) => e.name).sort()).toEqual([...WEBHOOK_EVENTS].sort());
  });
  it("give every schema example a property for each of its keys", () => {
    const spec = openApiSpec();
    for (const name of Object.keys(EXAMPLES) as SchemaName[]) {
      const schemas = spec.components.schemas as Record<string, { properties: Record<string, unknown> }>;
      const props = Object.keys(schemas[name].properties);
      expect(Object.keys(EXAMPLES[name]).filter((k) => !props.includes(k)), name).toEqual([]);
    }
  });
  it("use unique operation ids", () => {
    const ids = ENDPOINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
