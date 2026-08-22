import Anthropic from "@anthropic-ai/sdk";

export function isExtractionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const FIELD_META: Record<string, { label: string; groupLabel: string }> = {
  clientName: { label: "Client", groupLabel: "Client & engagement" },
  service: { label: "Service", groupLabel: "Client & engagement" },
  startDate: { label: "Start date", groupLabel: "Client & engagement" },
  duration: { label: "Duration", groupLabel: "Client & engagement" },
  deliverables: { label: "Deliverables", groupLabel: "Scope" },
  fee: { label: "Fee", groupLabel: "Commercial terms" },
  paymentTerms: { label: "Payment terms", groupLabel: "Commercial terms" },
  cancellation: { label: "Cancellation terms", groupLabel: "Commercial terms" },
  billingAddress: { label: "Billing address", groupLabel: "Commercial terms" },
};

export function fieldMeta(fieldKey: string): { label: string; groupLabel: string } {
  return FIELD_META[fieldKey] ?? { label: fieldKey, groupLabel: "Deal details" };
}

export type ExtractedField = {
  fieldKey: string;
  value: string | null;
  sourceQuote: string | null;
  confidence: number;
};

export type ExtractedDeal = {
  clientName: string;
  company: string | null;
  email: string | null;
  fields: ExtractedField[];
};

export async function extractDealFromTranscript(transcript: string, placeholderKeys: string[]): Promise<ExtractedDeal> {
  const client = new Anthropic();

  const fieldKeys = [...new Set(["service", "fee", ...placeholderKeys])];

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system:
      "You extract structured sales-deal terms from a raw call transcript between an agency and a prospective client. " +
      "Only report a field if the transcript actually states it — never invent numbers, dates, or names. " +
      "For every extracted field, quote the exact transcript sentence it came from.",
    messages: [
      {
        role: "user",
        content: `Extract the deal terms from this call transcript:\n\n${transcript}`,
      },
    ],
    tools: [
      {
        name: "record_deal_terms",
        description: "Record the deal terms found in the call transcript.",
        input_schema: {
          type: "object",
          properties: {
            clientName: { type: "string", description: "The client contact's full name" },
            company: { type: "string", description: "The client's company name, if mentioned" },
            email: { type: "string", description: "The client's email address, if mentioned" },
            fields: {
              type: "array",
              description: "One entry per requested field key, in the same order given.",
              items: {
                type: "object",
                properties: {
                  fieldKey: { type: "string", enum: fieldKeys },
                  value: { type: "string", description: "The extracted value, formatted naturally (e.g. fee as '€2,500 / month'). Empty string if not mentioned." },
                  sourceQuote: { type: "string", description: "The exact transcript sentence supporting this value. Empty string if not mentioned." },
                  confidence: { type: "number", description: "0 to 1 — how directly the transcript states this value." },
                },
                required: ["fieldKey", "value", "sourceQuote", "confidence"],
              },
            },
          },
          required: ["clientName", "fields"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_deal_terms" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude didn't return structured deal terms");
  }

  const input = toolUse.input as {
    clientName: string;
    company?: string;
    email?: string;
    fields: { fieldKey: string; value: string; sourceQuote: string; confidence: number }[];
  };

  return {
    clientName: input.clientName,
    company: input.company?.trim() || null,
    email: input.email?.trim() || null,
    fields: input.fields.map((f) => ({
      fieldKey: f.fieldKey,
      value: f.value?.trim() || null,
      sourceQuote: f.sourceQuote?.trim() || null,
      confidence: f.confidence,
    })),
  };
}

export type DealFieldRow = {
  groupLabel: string;
  label: string;
  fieldKey: string;
  value: string | null;
  status: string;
  confidence: number | null;
  sourceQuote: string | null;
  orderIndex: number;
};

export function buildDealFieldRows(
  extracted: ExtractedDeal,
  placeholderKeys: string[]
): { fieldRows: DealFieldRow[]; hasMissing: boolean; service: string; fee: string } {
  const byKey = new Map(extracted.fields.map((f) => [f.fieldKey, f]));

  const fieldRows: DealFieldRow[] = placeholderKeys.map((fieldKey, i) => {
    const meta = fieldMeta(fieldKey);
    const extractedField = byKey.get(fieldKey);
    return {
      groupLabel: meta.groupLabel,
      label: meta.label,
      fieldKey,
      value: extractedField?.value ?? null,
      status: extractedField?.value ? "extracted" : "missing",
      confidence: extractedField?.confidence ?? null,
      sourceQuote: extractedField?.sourceQuote ?? null,
      orderIndex: i,
    };
  });
  if (!fieldRows.some((f) => f.fieldKey === "clientName")) {
    fieldRows.unshift({
      groupLabel: "Client & engagement",
      label: "Client",
      fieldKey: "clientName",
      value: extracted.clientName,
      status: "extracted",
      confidence: 1,
      sourceQuote: null,
      orderIndex: -1,
    });
  }

  return {
    fieldRows,
    hasMissing: fieldRows.some((f) => f.status === "missing"),
    service: byKey.get("service")?.value ?? "",
    fee: byKey.get("fee")?.value ?? "",
  };
}
