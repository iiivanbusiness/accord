import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/transcript-deal", () => ({}));
vi.mock("@/lib/auto-send", () => ({}));
vi.mock("@/lib/notifications", () => ({}));
vi.mock("@/lib/email", () => ({}));
vi.mock("@/lib/webhooks", () => ({}));
vi.mock("@/lib/error-report", () => ({ reportError: async () => {} }));
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));

import { suggestTemplateId } from "./sales-call";

const templates = [
  { id: "a", name: "Social Media Retainer", description: "Monthly content" },
  { id: "b", name: "Website Build", description: "One-off project" },
];

describe("Template for a sales call", () => {
  it("doesn't ask the model when there's only one template", async () => {
    expect(await suggestTemplateId("anything", [templates[0]])).toBe("a");
    expect(create).not.toHaveBeenCalled();
  });

  it("uses the model's pick, and falls back to the first on a bad answer", async () => {
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "2" }] });
    expect(await suggestTemplateId("we'll build your website", templates)).toBe("b");
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "none of these" }] });
    expect(await suggestTemplateId("unclear", templates)).toBe("a");
    create.mockRejectedValueOnce(new Error("overloaded"));
    expect(await suggestTemplateId("unclear", templates)).toBe("a");
  });
});
