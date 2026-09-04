import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export type ProposedCorrection =
  | {
      intent: "update_field";
      fieldKey: string;
      fieldLabel: string;
      currentValue: string | null;
      proposedValue: string;
      confirmationText: string;
    }
  | { intent: "unclear"; confirmationText: string };

// Turns one push-to-talk clip's transcript into a single proposed field
// change — never applies it. The rep hears confirmationText read back and
// has to explicitly confirm (see applyVoiceFieldCorrection in
// deals/[id]/actions.ts) before anything is actually written to the
// contract; a misheard number this way surfaces as a wrong-sounding
// confirmation instead of a silently wrong contract.
export async function interpretVoiceCorrection(dealId: string, transcript: string): Promise<ProposedCorrection | null> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { fields: true } });
  if (!deal) return null;

  const editableFields = deal.fields.filter((f) => f.status !== "missing");
  if (editableFields.length === 0) return null;

  const fieldList = editableFields.map((f) => `${f.fieldKey} (${f.label}): currently "${f.value ?? "(empty)"}"`).join("\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system:
      "The rep just spoke a correction for a contract, right after hearing a spoken recap of what was filled " +
      "in. Figure out which field they want changed and to what — match loosely (they might say \"price\" for " +
      "a field labeled \"Fee\", or speak in a different language than the fields are recorded in). Only one " +
      "field per correction. If you can't confidently match it to one of the listed fields, use the `unclear` " +
      "tool instead of guessing. Always write confirmationText in English regardless of what language the rep " +
      "spoke — a short, natural spoken line reading back exactly what you understood, e.g. \"Got it — changing " +
      "the fee to three thousand dollars. Confirm?\"",
    messages: [
      {
        role: "user",
        content: `Current contract fields:\n${fieldList}\n\nWhat the rep just said: "${transcript}"`,
      },
    ],
    tools: [
      {
        name: "propose_field_change",
        description: "Propose a single field change based on what the rep said.",
        input_schema: {
          type: "object",
          properties: {
            fieldKey: { type: "string", enum: editableFields.map((f) => f.fieldKey) },
            proposedValue: { type: "string", description: "The new value, formatted naturally the way it should appear in the contract." },
            confirmationText: { type: "string", description: "A short spoken question (in English) reading back the proposed change." },
          },
          required: ["fieldKey", "proposedValue", "confirmationText"],
        },
      },
      {
        name: "unclear",
        description: "Use this when the correction can't be confidently matched to a listed field.",
        input_schema: {
          type: "object",
          properties: {
            confirmationText: {
              type: "string",
              description: "A short spoken line (in English) saying you didn't catch a clear instruction, asking them to try again.",
            },
          },
          required: ["confirmationText"],
        },
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  if (toolUse.name === "unclear") {
    const input = toolUse.input as { confirmationText: string };
    return { intent: "unclear", confirmationText: input.confirmationText };
  }

  const input = toolUse.input as { fieldKey: string; proposedValue: string; confirmationText: string };
  const field = editableFields.find((f) => f.fieldKey === input.fieldKey);
  if (!field) return null;

  return {
    intent: "update_field",
    fieldKey: field.fieldKey,
    fieldLabel: field.label,
    currentValue: field.value,
    proposedValue: input.proposedValue,
    confirmationText: input.confirmationText,
  };
}
