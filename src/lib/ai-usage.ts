import { AsyncLocalStorage } from "node:async_hooks";

// Anthropic list prices, USD per million tokens, by model family. Checked
// against the Claude Console when call costs were compared (Phase 3.4).
const USD_PER_MTOK: { match: string; input: number; output: number }[] = [
  { match: "haiku", input: 1, output: 5 },
  { match: "sonnet", input: 2, output: 10 },
  { match: "opus", input: 4, output: 20 },
];

export type AiUsage = { inputTokens: number; outputTokens: number; costUsd: number };
type ModelUsage = { input_tokens: number; output_tokens: number };

export function aiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = USD_PER_MTOK.find((p) => model.includes(p.match)) ?? USD_PER_MTOK[USD_PER_MTOK.length - 1];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

const meter = new AsyncLocalStorage<AiUsage>();

// Counts one model call toward whatever is being metered right now (a phone
// call being written up). Elsewhere it does nothing, so shared extraction
// code can call it unconditionally.
export function recordAiUsage(message: { model: string; usage: ModelUsage }): void {
  const total = meter.getStore();
  if (!total) return;
  total.inputTokens += message.usage.input_tokens;
  total.outputTokens += message.usage.output_tokens;
  total.costUsd += aiCostUsd(message.model, message.usage.input_tokens, message.usage.output_tokens);
}

// Runs fn and adds up every model call made inside it, however deep.
export async function meterAiUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AiUsage }> {
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const result = await meter.run(usage, fn);
  return { result, usage };
}
