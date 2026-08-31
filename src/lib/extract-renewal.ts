import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { fillClauses } from "@/lib/contract";

// Runs once, right after a contract is signed — reads the final filled
// clause text (the exact legal language, not a raw template placeholder)
// and asks Claude to pull out when the term ends, whether it auto-renews,
// and a one-line human summary. Best-effort: a failure here should never
// affect signing itself, so callers wrap this in try/catch.
export async function extractRenewalTerms(contractId: string): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { deal: { include: { fields: true } }, template: true },
  });
  if (!contract || !contract.template || !contract.signedAt) return;

  const clauses = fillClauses(contract.template.clauses, contract.deal.fields);
  const contractText = clauses.map((c) => `${c.title}\n${c.body}`).join("\n\n");
  if (!contractText.trim()) return;

  const client = new Anthropic();
  const signedDateIso = contract.signedAt.toISOString().slice(0, 10);

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system:
      "You read a signed contract's text and figure out when its current term ends and whether it renews " +
      "automatically. Only report a date if the contract actually states or implies one (a fixed term length " +
      "counts, e.g. \"continues for 3 months\" starting from the given signed date) — never invent one. " +
      `Today's reference date for resolving relative terms is the date the contract was signed: ${signedDateIso}.`,
    messages: [
      {
        role: "user",
        content: `Signed date: ${signedDateIso}\n\nContract text:\n\n${contractText}`,
      },
    ],
    tools: [
      {
        name: "record_renewal_terms",
        description: "Record when this contract's current term ends and its renewal behavior.",
        input_schema: {
          type: "object",
          properties: {
            renewalDate: {
              type: "string",
              description: "ISO date (YYYY-MM-DD) the current term ends or next renews on. Empty string if the contract doesn't state a term.",
            },
            autoRenews: { type: "boolean", description: "True if the contract renews automatically unless notice is given." },
            renewalNote: { type: "string", description: "One short plain-English sentence summarizing the renewal terms, e.g. \"Renews monthly unless 30 days' notice given.\" Empty string if there's no term." },
          },
          required: ["renewalDate", "autoRenews", "renewalNote"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_renewal_terms" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return;

  const input = toolUse.input as { renewalDate: string; autoRenews: boolean; renewalNote: string };
  const renewalDate = input.renewalDate?.trim() ? new Date(input.renewalDate.trim()) : null;
  if (renewalDate && Number.isNaN(renewalDate.getTime())) return;

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      renewalDate,
      autoRenews: Boolean(input.autoRenews) && Boolean(renewalDate),
      renewalNote: input.renewalNote?.trim() || null,
    },
  });
}
