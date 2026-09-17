"use client";

import { useState } from "react";
import { FAQ_CATEGORIES } from "@/lib/faq-content";

type FaqMessage = { role: "assistant" | "user"; text: string };
type AiMessage = { role: "assistant" | "user"; text: string };
type Mode = "faq" | "ai";

const FAQ_GREETING = "Hi! What do you need help with?";
const AI_GREETING = "Ask me anything about SealMe. I can't see your account or deals, just how the product works.";

// Two independent chat modes sharing one floating widget: a canned FAQ
// (zero cost, no AI call) and a freeform AI chat backed by /api/support-chat.
// Rendered globally from AppShell so it's available on every authenticated
// page. Neither mode has access to the caller's account data by design.
export default function FaqChatWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("faq");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [faqMessages, setFaqMessages] = useState<FaqMessage[]>([{ role: "assistant", text: FAQ_GREETING }]);

  const [aiMessages, setAiMessages] = useState<AiMessage[]>([{ role: "assistant", text: AI_GREETING }]);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const category = categoryId ? FAQ_CATEGORIES.find((c) => c.id === categoryId) ?? null : null;

  function pickQuestion(question: string, answer: string) {
    setFaqMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: answer }]);
  }

  async function sendAiMessage() {
    const text = aiInput.trim();
    if (!text || aiSending) return;

    const nextMessages = [...aiMessages, { role: "user" as const, text }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiSending(true);
    setAiError(null);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map((m) => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      setAiMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong answering that");
    } finally {
      setAiSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        className="fixed bottom-24 right-5 z-50 flex h-12 w-12 flex-none items-center justify-center rounded-full md:bottom-6 md:right-6"
        style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-pop)" }}
      >
        {open ? (
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" width={18} height={18}>
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
            <path d="M3 5.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v6.2c0 1.1-.9 2-2 2H9.4L5.5 17v-3.3H5c-1.1 0-2-.9-2-2V5.5z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="card fixed bottom-40 right-5 z-50 flex max-h-[min(560px,70vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden md:bottom-24 md:right-6">
          <div className="flex flex-none items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex items-center gap-1 rounded-[10px] p-0.5" style={{ background: "var(--surface-2)" }}>
              <button
                type="button"
                onClick={() => setMode("faq")}
                className="rounded-[8px] px-2.5 py-1 text-[12px] font-medium"
                style={mode === "faq" ? { background: "var(--surface-1)", color: "var(--ink)" } : { color: "var(--ink-muted)" }}
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className="rounded-[8px] px-2.5 py-1 text-[12px] font-medium"
                style={mode === "ai" ? { background: "var(--surface-1)", color: "var(--ink)" } : { color: "var(--ink-muted)" }}
              >
                Ask AI
              </button>
            </div>
            {mode === "faq" && category && (
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className="text-[12px] font-medium"
                style={{ color: "var(--ink-muted)" }}
              >
                ← Topics
              </button>
            )}
          </div>

          {mode === "faq" ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
                {faqMessages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} text={m.text} />
                ))}
              </div>

              <div className="flex-none border-t px-3.5 py-3" style={{ borderColor: "var(--hairline)" }}>
                <div className="flex max-h-[168px] flex-col gap-1 overflow-y-auto">
                  {!category
                    ? FAQ_CATEGORIES.map((c) => (
                        <OptionButton key={c.id} onClick={() => setCategoryId(c.id)}>
                          {c.label}
                        </OptionButton>
                      ))
                    : category.questions.map((q) => (
                        <OptionButton key={q.question} onClick={() => pickQuestion(q.question, q.answer)}>
                          {q.question}
                        </OptionButton>
                      ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
                {aiMessages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} text={m.text} />
                ))}
                {aiSending && <ChatBubble role="assistant" text="…" />}
                {aiError && (
                  <div className="max-w-[85%] rounded-[14px] px-3 py-2 text-[13px]" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    {aiError}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendAiMessage();
                }}
                className="flex flex-none items-center gap-2 border-t px-3.5 py-3"
                style={{ borderColor: "var(--hairline)" }}
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Type a question…"
                  disabled={aiSending}
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-[10px] px-3 py-2 text-[13px]"
                  style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                />
                <button
                  type="submit"
                  disabled={aiSending || !aiInput.trim()}
                  className="btn btn-primary btn-sm flex-none"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ChatBubble({ role, text }: { role: "assistant" | "user"; text: string }) {
  return (
    <div
      className="max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
      style={
        role === "user"
          ? { alignSelf: "flex-end", background: "var(--primary)", color: "var(--on-primary)" }
          : { alignSelf: "flex-start", background: "var(--surface-2)", color: "var(--ink)" }
      }
    >
      {text}
    </div>
  );
}

function OptionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
    >
      {children}
    </button>
  );
}
