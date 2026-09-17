import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { faqKnowledgeText } from "@/lib/faq-content";

// Freeform AI support chat — deliberately separate from the FAQ chat's
// canned answers. Auth-gated purely to keep this off the open internet and
// bound the cost, not because it reads anything account-specific: this
// route never touches Prisma or the caller's workspace. The model only
// gets product knowledge (faqKnowledgeText) and the caller's own chat
// history, nothing about their deals, clients, or contracts.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isValidHistory(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_HISTORY_MESSAGES &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length <= MAX_MESSAGE_LENGTH
    )
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messages = body?.messages;
  if (!isValidHistory(messages)) {
    return NextResponse.json({ error: "Invalid message history" }, { status: 400 });
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "You are SealMe's support assistant, answering questions in a chat widget inside the app. " +
        "SealMe helps sales teams record calls, draft contracts from them with AI, route them for approval, " +
        "get them signed, and sync closed deals to Salesforce or HubSpot.\n\n" +
        "You do not have access to this user's account, deals, contracts, or any other personal data — never " +
        "claim to look anything up, and never ask for account details. Answer only from the product facts below. " +
        "If a question needs account-specific info, or the facts below don't cover it, say you don't have that " +
        "detail and suggest contacting support instead of guessing.\n\n" +
        "Keep answers short, two to four sentences, plain language, no markdown headers. " +
        "Never use em dashes or other long dashes, write plain sentences with commas or periods instead.\n\n" +
        "Product facts:\n" +
        faqKnowledgeText(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("Support chat request failed", err);
    return NextResponse.json({ error: "Something went wrong answering that" }, { status: 502 });
  }
}
