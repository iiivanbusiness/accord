"use client";

import { useState } from "react";
import { FAQ_CATEGORIES } from "@/lib/faq-content";

type Message = { role: "assistant" | "user"; text: string };

const GREETING = "Hi! What do you need help with?";

// Static, canned FAQ, zero cost, no AI call — separate from the freeform
// AI chat planned for later. Rendered globally from AppShell so it's
// available on every authenticated page.
export default function FaqChatWidget() {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: GREETING }]);

  const category = categoryId ? FAQ_CATEGORIES.find((c) => c.id === categoryId) ?? null : null;

  function pickQuestion(question: string, answer: string) {
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: answer }]);
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
            <span className="text-[13.5px] font-medium">Help</span>
            {category && (
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

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className="max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
                style={
                  m.role === "user"
                    ? { alignSelf: "flex-end", background: "var(--primary)", color: "var(--on-primary)" }
                    : { alignSelf: "flex-start", background: "var(--surface-2)", color: "var(--ink)" }
                }
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="flex-none border-t px-3.5 py-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex max-h-[168px] flex-col gap-1 overflow-y-auto">
              {!category
                ? FAQ_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className="rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium"
                      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
                    >
                      {c.label}
                    </button>
                  ))
                : category.questions.map((q) => (
                    <button
                      key={q.question}
                      type="button"
                      onClick={() => pickQuestion(q.question, q.answer)}
                      className="rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium"
                      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
                    >
                      {q.question}
                    </button>
                  ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
